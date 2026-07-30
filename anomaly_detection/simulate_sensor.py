import json
import logging
import random
import time
import sys

import paho.mqtt.client as mqtt

BROKER_HOST = "localhost"
BROKER_PORT = 1883
SENSOR_TOPIC = "factory/sensor/reading"
CONTROL_TOPIC = "factory/machine/control"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("simulate_sensor")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="sensor-simulator")


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        log.info(f"Connected to broker. Subscribing to '{CONTROL_TOPIC}'")
        client.subscribe(CONTROL_TOPIC, qos=1)
    else:
        log.error(f"Connection failed, reason code: {reason_code}")


def on_control_message(client, userdata, msg):
    log.info(f"[control] {msg.payload.decode()}")


def make_reading(anomaly=False):
    if anomaly:
        return {
            "voltage": round(random.uniform(260, 300), 2),
            "current": round(random.uniform(15, 25), 2),
            "temperature": round(random.uniform(80, 100), 2),
        }
    return {
        "voltage": round(random.uniform(215, 225), 2),
        "current": round(random.uniform(4, 8), 2),
        "temperature": round(random.uniform(30, 45), 2),
    }


def main():
    client.on_connect = on_connect
    client.on_message = on_control_message
    
    while True:
        try:
            client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            break
        except (ConnectionRefusedError, OSError) as e:
            log.error(f"Broker not reachable ({e}), retrying in 5s...")
            time.sleep(5)

    client.loop_start()

    log.info("Publishing simulated readings. Ctrl+C to stop.")
    try:
        while True:
            anomaly = random.random() < 0.2
            reading = make_reading(anomaly)
            client.publish(SENSOR_TOPIC, json.dumps(reading), qos=1)
            log.info(f"[sensor] {reading} {'(anomaly-like)' if anomaly else ''}")
            time.sleep(2)
    except KeyboardInterrupt:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
