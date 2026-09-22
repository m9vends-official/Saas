import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

let mockPublishShouldFail = false;

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
    publish: vi.fn((topic, message, options, callback) => {
      const cb = typeof options === 'function' ? options : callback;
      if (mockPublishShouldFail) {
        cb(new Error("MQTT Publish Failed"));
      } else {
        cb(null);
      }
    }),
    end: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn(() => mockMqttClient),
    },
    connect: vi.fn(() => mockMqttClient),
  };
});

// Import models before app so mongoose compiles them
import { Devices } from "../models/device.model.js";
import { User } from "../models/user.model.js";

let app: any;

describe("POST /api/device/provision", () => {
  beforeAll(async () => {
    const dbName = `test_provision_${Math.random().toString(36).substring(2, 9)}`;
    process.env.MONGODB_STRING = `mongodb://localhost:27017/${dbName}`;
    app = (await import("../app.js")).default;
  });

  beforeEach(async () => {
    await Devices.deleteMany({});
    await User.deleteMany({});
    mockPublishShouldFail = false;
  });

  afterAll(async () => {
    try {
      await mongoose.connection.db?.dropDatabase();
    } catch {}
    await mongoose.connection.close();
  });

  it("should return 400 Bad Request if serialNumber or userID is missing", async () => {
    const res1 = await request(app)
      .post("/api/device/provision")
      .send({ userID: new mongoose.Types.ObjectId().toString() });
    
    expect(res1.status).toBe(400);
    expect(res1.body.message).toBe("Bad Request");

    const res2 = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345" });
    
    expect(res2.status).toBe(400);
    expect(res2.body.message).toBe("Bad Request");
  });

  it("should return 400 Invalid User ID if userID is not a valid ObjectId", async () => {
    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: "invalid-id" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid User ID");
  });

  it("should return 404 User Not Found if user does not exist", async () => {
    const fakeUserId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: fakeUserId });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("User Not Found");
  });

  it("should return 404 Device Not Configured if device does not exist", async () => {
    const user = await User.create({ email: "test@user.com", devices: [] });
    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: user._id.toString() });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Device Not Configured");
  });

  it("should return 409 Device Already Owned if device is already provisioned", async () => {
    const existingOwnerId = new mongoose.Types.ObjectId();
    const user = await User.create({ email: "test@user.com", devices: [] });
    
    await Devices.create({
      serialNumber: "SN12345",
      model: "Model-X",
      owner: existingOwnerId,
      ip: "192.168.1.1",
      status: "offline",
      components: []
    });

    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: user._id.toString() });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Device Already Owned");
  });

  it("should successfully provision device if all parameters are valid", async () => {
    const user = await User.create({ email: "test@user.com", devices: [] });
    const device = await Devices.create({
      serialNumber: "SN12345",
      model: "Model-X",
      ip: "192.168.1.1",
      status: "offline",
      components: []
    });

    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: user._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.vid).toBe(device._id.toString());
    expect(res.body.message).toBe("Provisioning Successful");

    // Verify DB updates
    const updatedDevice = await Devices.findById(device._id);
    expect(updatedDevice?.owner?.toString()).toBe(user._id.toString());

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.devices.map(d => d.toString())).toContain(device._id.toString());
  });

  it("should return 500 error if MQTT publish fails", async () => {
    mockPublishShouldFail = true;
    const user = await User.create({ email: "test@user.com", devices: [] });
    const device = await Devices.create({
      serialNumber: "SN12345",
      model: "Model-X",
      ip: "192.168.1.1",
      status: "offline",
      components: []
    });

    const res = await request(app)
      .post("/api/device/provision")
      .send({ serialNumber: "SN12345", userID: user._id.toString() });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Couldn't Reach Device, Please try restarting it...");
  });
});
