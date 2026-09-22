import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

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

let app: any;

describe("GET /api/device/connect/:id", () => {
  beforeAll(async () => {
    const dbName = `test_connect_${Math.random().toString(36).substring(2, 9)}`;
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

  it("should return 400 Invalid Device ID if id is not a valid ObjectId", async () => {
    const res = await request(app).get("/api/device/connect/invalid-id");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Device ID");
  });

  it("should return 400 if device does not exist in database", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/device/connect/${fakeId}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Device doesn't exist, Invalid Id");
  });

  it("should return 400 if device exists but has no owner", async () => {
    const device = await Devices.create({
      serialNumber: "SN-CONN-1",
      model: "Model-T",
      ip: "192.168.1.100",
      status: "offline",
      components: []
    });

    const res = await request(app).get(`/api/device/connect/${device._id.toString()}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Device doesn't exist, Invalid Id");
  });

  it("should return 200 and valid MQTT credentials if device exists and has an owner", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const device = await Devices.create({
      serialNumber: "SN-CONN-2",
      model: "Model-T",
      owner: ownerId,
      ip: "192.168.1.100",
      status: "offline",
      components: []
    });

    const res = await request(app).get(`/api/device/connect/${device._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Successfully generated mqtt credentials");
    expect(res.body.mqttCredentials).toBeDefined();
    expect(res.body.mqttCredentials.expiresIn).toBe("25m");
    expect(res.body.mqttCredentials.token).toBeDefined();

    // Verify token content using secret
    const decoded = jwt.verify(res.body.mqttCredentials.token, process.env.MQTT_JWT_SECRET as string) as {
      client_attrs: { deviceVID: string };
    };
    expect(decoded.client_attrs.deviceVID).toBe(device._id.toString());
  });
});
