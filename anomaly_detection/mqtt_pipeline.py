import json
import logging
import time

import paho.mqtt.client as mqtt

try:
    from .inference import AnomalyDetector
except ImportError:  # Allows `python mqtt_pipeline.py` from inside anomaly_detection.
    from inference import AnomalyDetector

BROKER_HOST = "localhost"
BROKER_PORT = 1883
SENSOR_TOPIC = "factory/sensor/reading"
CONTROL_TOPIC = "factory/machine/control"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("mqtt_pipeline")


class AnomalyPipeline(AnomalyDetector):
    def __init__(self):
        super().__init__()
        self.load()
        log.info(f"Model loaded. Features expected: {self.features}")


pipeline = None


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log.info(f"Connected to broker. Subscribing to '{SENSOR_TOPIC}'")
        client.subscribe(SENSOR_TOPIC, qos=1)
    else:
        log.error(f"Connection failed, reason code: {reason_code}")


def on_message(client, userdata, msg):
    global pipeline
    try:
        reading = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        log.error(f"Invalid JSON on {msg.topic}: {msg.payload}")
        return

    try:
        result = pipeline.predict(reading)
    except ValueError as e:
        log.error(str(e))
        return

    payload = json.dumps(result)
    client.publish(CONTROL_TOPIC, payload, qos=1)

    if result["action"] == "STOP_MACHINE":
        log.warning(f"ANOMALY DETECTED -> STOP_MACHINE | {payload}")
    else:
        log.info(f"Normal reading -> CONTINUE | prob={result['anomaly_probability']}")


def main():
    global pipeline
    pipeline = AnomalyPipeline()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="anomaly-inference-service")
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            break
        except (ConnectionRefusedError, OSError) as e:
            log.error(f"Broker not reachable ({e}), retrying in 5s...")
            time.sleep(5)

    client.loop_forever()


if __name__ == "__main__":
    main()
