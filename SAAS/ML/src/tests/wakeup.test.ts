import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

vi.mock("mqtt", () => {
  const mockMqttClient = {
    on: vi.fn((event, callback) => {
      if (event === "connect") {
        setTimeout(() => callback(), 0);
      }
      return mockMqttClient;
    }),
    subscribe: vi.fn((topic, callback) => {
      if (callback) callback(null);
      return mockMqttClient;
    }),
    publish: vi.fn(),
    end: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn(() => mockMqttClient),
    },
    connect: vi.fn(() => mockMqttClient),
  };
});

import { Devices } from "../models/device.model.js";
import { updateDeviceStatus, isDeviceOnline } from "../services/device.services.js";

let app: any;

describe("POST /api/device/wake-up & Device Status Services", () => {
  beforeAll(async () => {
    const dbName = `test_wakeup_${Math.random().toString(36).substring(2, 9)}`;
    process.env.MONGODB_STRING = `mongodb://localhost:27017/${dbName}`;
    app = (await import("../app.js")).default;
  });

  beforeEach(async () => {
    await Devices.deleteMany({});
  });

  afterAll(async () => {
    try {
      await mongoose.connection.db?.dropDatabase();
    } catch {}
    await mongoose.connection.close();
  });

  describe("POST /api/device/wake-up API", () => {
    it("should create a new device if it does not already exist", async () => {
      const devicePayload = {
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        mac: "11:22:33:44:55:66",
        ip: "192.168.1.100",
        status: "online" as const,
        components: [
          { id: 1, catagory: "sensor", name: "Temp Sensor", type: "sensor" as const }
        ]
      };

      const res = await request(app)
        .post("/api/device/wake-up")
        .send(devicePayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Created New Device");
      expect(res.body.isProvisioned).toBe(false);
      expect(res.body.deviceVID).toBeDefined();
      expect(res.body.mqtt).toEqual({
        url: process.env.MQTT_BROKER_URL,
        port: parseInt(process.env.MQTT_BROKER_PORT as string),
        username: process.env.MQTT_BROKER_Device_USERNAME,
        password: process.env.MQTT_BROKER_Device_PASSWORD
      });
      expect(res.body.topics).toEqual({
        pub: ["telemetry", "status"],
        sub: ["commands"]
      });

      const dbDevice = await Devices.findById(res.body.deviceVID);
      expect(dbDevice).toBeDefined();
      expect(dbDevice?.serialNumber).toBe("SN-WAKE-1");
    });

    it("should return wakeup existing device if it already exists", async () => {
      const existingDevice = await Devices.create({
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      const devicePayload = {
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "online" as const,
        components: []
      };

      const res = await request(app)
        .post("/api/device/wake-up")
        .send(devicePayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Wakeup Existing Device");
      expect(res.body.isProvisioned).toBe(false);
      expect(res.body.deviceVID).toBe(existingDevice._id.toString());
      expect(res.body.mqtt).toEqual({
        url: process.env.MQTT_BROKER_URL,
        port: parseInt(process.env.MQTT_BROKER_PORT as string),
        username: process.env.MQTT_BROKER_Device_USERNAME,
        password: process.env.MQTT_BROKER_Device_PASSWORD
      });
      expect(res.body.topics).toEqual({
        pub: ["telemetry", "status"],
        sub: ["commands"]
      });
      expect(res.body.kioskBrowserURL).toBe(`${process.env.KIOSK_BASE_URL}undefined`);
    });

    it("should update the IP of the existing device if the new IP is different", async () => {
      const existingDevice = await Devices.create({
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      const devicePayload = {
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        ip: "192.168.1.222", // New IP
        status: "online" as const,
        components: []
      };

      const res = await request(app)
        .post("/api/device/wake-up")
        .send(devicePayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Wakeup Existing Device");

      const dbDevice = await Devices.findById(existingDevice._id);
      expect(dbDevice?.ip).toBe("192.168.1.222");
    });

    it("should return isProvisioned true and kioskBrowserURL if existing device is owned", async () => {
      const fakeOwnerId = new mongoose.Types.ObjectId();
      const existingDevice = await Devices.create({
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        owner: fakeOwnerId,
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      const devicePayload = {
        serialNumber: "SN-WAKE-1",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "online" as const,
        components: []
      };

      const res = await request(app)
        .post("/api/device/wake-up")
        .send(devicePayload);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Wakeup Existing Device");
      expect(res.body.isProvisioned).toBe(true);
      expect(res.body.kioskBrowserURL).toBe(`${process.env.KIOSK_BASE_URL}${fakeOwnerId.toString()}`);
    });

    it("should return error if payload validation fails (e.g. missing required fields)", async () => {
      const res = await request(app)
        .post("/api/device/wake-up")
        .send({
          model: "Model-T"
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Something Went Wrong");
    });
  });

  describe("updateDeviceStatus service", () => {
    it("should successfully update device status to online or offline", async () => {
      const device = await Devices.create({
        serialNumber: "SN-STATUS-1",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      await updateDeviceStatus(device._id.toString(), "online");
      let updatedDevice = await Devices.findById(device._id);
      expect(updatedDevice?.status).toBe("online");

      await updateDeviceStatus(device._id.toString(), "offline");
      updatedDevice = await Devices.findById(device._id);
      expect(updatedDevice?.status).toBe("offline");
    });

    it("should throw error if device ID is invalid", async () => {
      await expect(updateDeviceStatus("invalid-id", "online")).rejects.toThrow("Invalid User ID");
    });

    it("should throw error if status is invalid", async () => {
      const device = await Devices.create({
        serialNumber: "SN-STATUS-2",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      await expect(updateDeviceStatus(device._id.toString(), "invalid-status")).rejects.toThrow("Invalid Status");
    });
  });

  describe("isDeviceOnline service", () => {
    it("should return true if device is online", async () => {
      const device = await Devices.create({
        serialNumber: "SN-STATUS-3",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "online",
        components: []
      });

      const online = await isDeviceOnline(device._id);
      expect(online).toBe(true);
    });

    it("should return false if device is offline", async () => {
      const device = await Devices.create({
        serialNumber: "SN-STATUS-4",
        model: "Model-T",
        ip: "192.168.1.100",
        status: "offline",
        components: []
      });

      const online = await isDeviceOnline(device._id);
      expect(online).toBe(false);
    });

    it("should throw error if device does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(isDeviceOnline(fakeId)).rejects.toThrow("Device not exists");
    });
  });
});
