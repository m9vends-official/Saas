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
import { User } from "../models/user.model.js";

let app: any;

describe("GET /api/device/:type/:id", () => {
  beforeAll(async () => {
    const dbName = `test_get_${Math.random().toString(36).substring(2, 9)}`;
    process.env.MONGODB_STRING = `mongodb://localhost:27017/${dbName}`;
    app = (await import("../app.js")).default;
  });

  beforeEach(async () => {
    await Devices.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    try {
      await mongoose.connection.db?.dropDatabase();
    } catch {}
    await mongoose.connection.close();
  });

  describe("type = device", () => {
    it("should return 400 Invalid Device ID if id is not a valid ObjectId", async () => {
      const res = await request(app).get("/api/device/device/invalid-id");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid Device ID");
    });

    it("should return 400 Invalid Device ID if device does not exist (due to service try-catch block wrapping all errors as 400)", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/device/device/${fakeId}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid Device ID");
    });

    it("should return 200 and device details on success", async () => {
      const device = await Devices.create({
        serialNumber: "SN-GET-1",
        model: "Model-X",
        ip: "192.168.1.100",
        status: "online",
        components: []
      });

      const res = await request(app).get(`/api/device/device/${device._id.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("device fetched successfully");
      expect(res.body.device._id).toBe(device._id.toString());
      expect(res.body.device.serialNumber).toBe("SN-GET-1");
    });
  });

  describe("type = user", () => {
    it("should return 400 Invalid User ID if id is not a valid ObjectId", async () => {
      const res = await request(app).get("/api/device/user/invalid-id");

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid User ID");
    });

    it("should return 404 User Not Exists if user does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/device/user/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User Not Exists");
    });

    it("should return 404 No Devices Found if user exists but has no devices", async () => {
      const user = await User.create({ email: "test@user.com", devices: [] });
      const res = await request(app).get(`/api/device/user/${user._id.toString()}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("No Devices Found");
    });

    it("should return 200 and user devices on success", async () => {
      const user = await User.create({ email: "test@user.com", devices: [] });
      
      const device1 = await Devices.create({
        serialNumber: "SN-GET-1",
        model: "Model-X",
        owner: user._id,
        ip: "192.168.1.100",
        status: "online",
        components: []
      });

      const device2 = await Devices.create({
        serialNumber: "SN-GET-2",
        model: "Model-Y",
        owner: user._id,
        ip: "192.168.1.101",
        status: "offline",
        components: []
      });

      // Update user to hold the reference
      await User.updateOne({ _id: user._id }, { $push: { devices: { $each: [device1._id, device2._id] } } });

      const res = await request(app).get(`/api/device/user/${user._id.toString()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("devices fetched successfully");
      expect(res.body.device.length).toBe(2);
      expect(res.body.device[0]._id).toBe(device1._id.toString());
      expect(res.body.device[1]._id).toBe(device2._id.toString());
    });
  });
});
