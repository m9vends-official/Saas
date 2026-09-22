import { Devices } from './models/device.model.js';
import { mqttClient } from './config/mqttBroker.config.js';

export const startSimulator = () => {
    console.log("[Simulator] Starting hardware simulation loop...");

    setInterval(async () => {
        try {
            // Only simulate for devices that are "online" or maybe all devices?
            // The user wants to see data and anomalies. Let's simulate for ALL devices.
            const devices = await Devices.find({});
            
            for (const device of devices) {
                // 5% chance of anomaly
                const isAnomaly = Math.random() < 0.05;

                if (isAnomaly) {
                    const anomalies = [
                        "ANOMALY: HIGH CURRENT DETECTED (28A)",
                        "LOW WATER LEVEL WARNING (5%)",
                        "DOOR OPEN DETECTED",
                        "DISPENSE FAIL: MOTOR JAMMED"
                    ];
                    const randomAnomaly = anomalies[Math.floor(Math.random() * anomalies.length)];
                    mqttClient.publish(`device/${device._id.toString()}/telemetry`, randomAnomaly);
                    console.log(`[Simulator] Published ANOMALY for ${device.serialNumber}`);
                } else {
                    // Normal Telemetry
                    const telemetry = {
                        "Water Level": Math.floor(Math.random() * (100 - 60 + 1)) + 60,
                        "Motor Speed": Math.floor(Math.random() * (1600 - 1000 + 1)) + 1000,
                        "Current (A)": (Math.random() * (5 - 2) + 2).toFixed(2),
                        "Temperature (C)": Math.floor(Math.random() * (26 - 20 + 1)) + 20
                    };
                    mqttClient.publish(`device/${device._id.toString()}/telemetry`, JSON.stringify(telemetry));
                    // console.log(`[Simulator] Published normal telemetry for ${device.serialNumber}`);
                }
            }
        } catch (error) {
            console.error("[Simulator] Error during simulation tick:", error);
        }
    }, 10000); // Every 10 seconds
};
