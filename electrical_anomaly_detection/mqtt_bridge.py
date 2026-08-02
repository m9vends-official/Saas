import json
import logging
import os
import re
from threading import Lock

try:
    import paho.mqtt.client as mqtt
except ImportError as error:  # Keep the HTTP API usable if MQTT deps are missing.
    mqtt = None
    MQTT_IMPORT_ERROR = str(error)
else:
    MQTT_IMPORT_ERROR = None

try:
    from . import model as training
except ImportError:
    import model as training


log = logging.getLogger("electrical_anomaly_detection.mqtt")


DEFAULT_TELEMETRY_TOPICS = "device/+/telemetry,factory/sensor/reading"
DEFAULT_RESULT_TOPIC_TEMPLATE = "device/{machine_id}/anomaly"
DEFAULT_FALLBACK_RESULT_TOPIC = "factory/machine/control"
DEFAULT_COMMAND_TOPIC_TEMPLATE = "device/{machine_id}/commands"

FIELD_ALIASES = {
    "voltage": (
        "voltage",
        "Voltage",
        "Voltage Sensor",
        "VoltageSensor",
        "voltage_sensor",
        "voltageSensor",
        "AC Voltage",
        "Line Voltage",
    ),
    "current": (
        "current",
        "Current",
        "Current Sensor",
        "CurrentSensor",
        "current_sensor",
        "currentSensor",
        "Machine Current",
    ),
    "temperature": (
        "temperature",
        "Temperature",
        "Temp",
        "temp",
        "Steering Motor Temperature",
        "Motor Temperature",
        "motor_temperature",
        "temperature_sensor",
        "temperatureSensor",
    ),
}


def _env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError:
        log.warning("%s must be an integer; using %s", name, default)
        return default
    return parsed


def _env_float(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        log.warning("%s must be a number; using %s", name, default)
        return default


def _split_topics(value):
    return [topic.strip() for topic in value.split(",") if topic.strip()]


def _success_reason(reason_code):
    if reason_code is None:
        return True
    if getattr(reason_code, "is_failure", False):
        return False
    try:
        return int(reason_code) == 0
    except (TypeError, ValueError):
        return str(reason_code).lower() == "success"


class MqttAnomalyBridge:
    def __init__(self, detector):
        self.detector = detector
        self.enabled = _env_bool("MQTT_ENABLED", True)
        self.host = os.getenv("MQTT_BROKER_HOST", os.getenv("BROKER_HOST", "localhost"))
        self.port = _env_int("MQTT_BROKER_PORT", _env_int("BROKER_PORT", 1883))
        self.username = os.getenv("MQTT_USERNAME", "")
        self.password = os.getenv("MQTT_PASSWORD", "")
        self.keepalive = _env_int("MQTT_KEEPALIVE_SECONDS", 60)
        self.qos = _env_int("MQTT_QOS", 1)
        self.client_id = os.getenv("MQTT_CLIENT_ID", "electrical-anomaly-service")
        self.use_tls = _env_bool("MQTT_TLS", False)
        self.telemetry_topics = _split_topics(
            os.getenv("MQTT_TELEMETRY_TOPICS", DEFAULT_TELEMETRY_TOPICS)
        )
        self.result_topic_template = os.getenv(
            "MQTT_RESULT_TOPIC_TEMPLATE", DEFAULT_RESULT_TOPIC_TEMPLATE
        )
        self.fallback_result_topic = os.getenv(
            "MQTT_FALLBACK_RESULT_TOPIC", DEFAULT_FALLBACK_RESULT_TOPIC
        )
        self.publish_commands = _env_bool("MQTT_PUBLISH_COMMANDS", False)
        self.command_topic_template = os.getenv(
            "MQTT_COMMAND_TOPIC_TEMPLATE", DEFAULT_COMMAND_TOPIC_TEMPLATE
        )
        self.scales = {
            "voltage": _env_float("MQTT_VOLTAGE_SCALE", 1.0),
            "current": _env_float("MQTT_CURRENT_SCALE", 1.0),
            "temperature": _env_float("MQTT_TEMPERATURE_SCALE", 1.0),
        }
        self._client = None
        self._lock = Lock()
        self._started = False
        self._connected = False
        self._last_error = MQTT_IMPORT_ERROR
        self._last_message_topic = None
        self._last_prediction = None
        self._messages_received = 0
        self._predictions_published = 0
        self._invalid_messages = 0

    def start(self):
        if not self.enabled:
            self._set_error(None)
            return

        if mqtt is None:
            self._set_error(f"paho-mqtt is not installed: {MQTT_IMPORT_ERROR}")
            log.error(self._last_error)
            return

        with self._lock:
            if self._started:
                return
            self._started = True

        try:
            client = self._make_client()
            if self.username:
                client.username_pw_set(self.username, self.password or None)
            if self.use_tls:
                client.tls_set()
            client.reconnect_delay_set(min_delay=1, max_delay=30)
            client.on_connect = self._on_connect
            client.on_disconnect = self._on_disconnect
            client.on_message = self._on_message

            self._client = client
            client.connect_async(self.host, self.port, keepalive=self.keepalive)
            client.loop_start()
        except Exception as error:
            self._record_start_failure(f"MQTT bridge failed to start: {error}")
            return

        log.info(
            "MQTT bridge starting: host=%s port=%s topics=%s",
            self.host,
            self.port,
            ", ".join(self.telemetry_topics),
        )

    def stop(self):
        client = self._client
        with self._lock:
            self._started = False
            self._connected = False
            self._client = None

        if client is None:
            return

        try:
            client.disconnect()
            client.loop_stop()
        except Exception as error:
            log.warning("Error while stopping MQTT bridge: %s", error)

    def status(self):
        with self._lock:
            return {
                "enabled": self.enabled,
                "started": self._started,
                "connected": self._connected,
                "host": self.host,
                "port": self.port,
                "telemetry_topics": self.telemetry_topics,
                "result_topic_template": self.result_topic_template,
                "fallback_result_topic": self.fallback_result_topic,
                "last_error": self._last_error,
                "last_message_topic": self._last_message_topic,
                "last_prediction": self._last_prediction,
                "messages_received": self._messages_received,
                "predictions_published": self._predictions_published,
                "invalid_messages": self._invalid_messages,
            }

    def _make_client(self):
        if hasattr(mqtt, "CallbackAPIVersion"):
            return mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id,
                protocol=mqtt.MQTTv311,
            )
        return mqtt.Client(client_id=self.client_id, protocol=mqtt.MQTTv311)

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if not _success_reason(reason_code):
            self._set_connected(False)
            self._set_error(f"MQTT connection failed: {reason_code}")
            log.error(self._last_error)
            return

        self._set_connected(True)
        self._set_error(None)
        for topic in self.telemetry_topics:
            client.subscribe(topic, qos=self.qos)
        log.info("MQTT bridge connected and subscribed")

    def _on_disconnect(self, client, userdata, *args):
        reason_code = None
        if len(args) == 1:
            reason_code = args[0]
        elif len(args) >= 2:
            reason_code = args[1]

        self._set_connected(False)
        if self._started:
            self._set_error(f"MQTT disconnected: {reason_code}")
            log.warning(self._last_error)

    def _on_message(self, client, userdata, message):
        raw_payload = message.payload.decode("utf-8", errors="replace")
        self._record_message(message.topic)

        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            self._record_invalid(f"Invalid JSON on {message.topic}: {raw_payload}")
            return

        reading = self._extract_reading(payload)
        if reading is None:
            self._record_invalid(
                f"Telemetry on {message.topic} does not contain voltage/current/temperature"
            )
            return

        machine_id = self._extract_machine_id(message.topic, payload)
        try:
            prediction = self.detector.predict(reading)
        except (FileNotFoundError, ValueError) as error:
            self._record_invalid(str(error))
            return

        enriched_prediction = {
            **prediction,
            "source": {
                "transport": "mqtt",
                "topic": message.topic,
                "machine_id": machine_id,
            },
        }
        result_topic = self._result_topic(machine_id)
        client.publish(result_topic, json.dumps(enriched_prediction), qos=self.qos)

        if (
            self.publish_commands
            and machine_id
            and enriched_prediction["action"] == "STOP_MACHINE"
        ):
            client.publish(
                self.command_topic_template.format(machine_id=machine_id, deviceVID=machine_id),
                json.dumps({"message": "STOP_MACHINE", "source": "electrical_anomaly_detection"}),
                qos=self.qos,
            )

        self._record_prediction(enriched_prediction)
        log.info(
            "MQTT prediction published to %s: action=%s anomaly=%s probability=%s",
            result_topic,
            enriched_prediction["action"],
            enriched_prediction["is_anomaly"],
            enriched_prediction["anomaly_probability"],
        )

    def _extract_reading(self, payload):
        if not isinstance(payload, dict):
            return None

        for candidate in self._candidate_payloads(payload):
            reading = {}
            for feature in self.detector.features or training.FEATURES:
                value = self._value_for_feature(candidate, feature)
                if value is None:
                    break
                reading[feature] = value * self.scales.get(feature, 1.0)
            else:
                return reading
        return None

    def _candidate_payloads(self, payload):
        yield payload
        for key in ("reading", "sensor", "sensors", "telemetry", "data"):
            nested = payload.get(key)
            if isinstance(nested, dict):
                yield nested

    def _value_for_feature(self, payload, feature):
        for key in FIELD_ALIASES.get(feature, (feature,)):
            if key not in payload:
                continue
            value = payload[key]
            if isinstance(value, bool):
                return None
            try:
                return float(value)
            except (TypeError, ValueError):
                return None
        return None

    def _extract_machine_id(self, topic, payload):
        for key in ("machine_id", "deviceVID", "device_id", "deviceId"):
            if key in payload and payload[key]:
                return str(payload[key])

        match = re.match(r"^device/([^/]+)/telemetry$", topic)
        if match:
            return match.group(1)
        return None

    def _result_topic(self, machine_id):
        if machine_id and self.result_topic_template:
            return self.result_topic_template.format(machine_id=machine_id, deviceVID=machine_id)
        return self.fallback_result_topic

    def _set_connected(self, value):
        with self._lock:
            self._connected = value

    def _set_error(self, value):
        with self._lock:
            self._last_error = value

    def _record_message(self, topic):
        with self._lock:
            self._messages_received += 1
            self._last_message_topic = topic

    def _record_invalid(self, message):
        with self._lock:
            self._invalid_messages += 1
            self._last_error = message
        log.warning(message)

    def _record_start_failure(self, message):
        with self._lock:
            self._started = False
            self._connected = False
            self._client = None
            self._last_error = message
        log.exception(message)

    def _record_prediction(self, prediction):
        with self._lock:
            self._predictions_published += 1
            self._last_prediction = prediction
            self._last_error = None
