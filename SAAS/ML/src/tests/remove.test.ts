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

describe("DELETE /api/device/:id", () => {
  beforeAll(async () => {
    const dbName = `test_remove_${Math.random().toString(36).substring(2, 9)}`;
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

  it("should return 400 Invalid User ID if id is not a valid ObjectId", async () => {
    const res = await request(app).delete("/api/device/invalid-id");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid User ID");
  });

  it("should return 500 No Device Exists if device does not exist", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/device/${fakeId}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("No Device Exists");
  });

  it("should successfully unlink device (unset owner) if command is not 'remove'", async () => {
    const user = await User.create({ email: "test@user.com", devices: [] });
    const device = await Devices.create({
      serialNumber: "SN-REM-1",
      model: "Model-T",
      owner: user._id,
      ip: "192.168.1.100",
      status: "offline",
      components: []
    });

    await User.updateOne({ _id: user._id }, { $push: { devices: device._id } });

    const res = await request(app).delete(`/api/device/${device._id.toString()}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Device Unlinked Successfully");

    // Verify DB updates
    const updatedDevice = await Devices.findById(device._id);
    expect(updatedDevice?.owner).toBeUndefined();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.devices).not.toContain(device._id);
  });

  it("should successfully remove (delete) device if command is 'remove'", async () => {
    const user = await User.create({ email: "test@user.com", devices: [] });
    const device = await Devices.create({
      serialNumber: "SN-REM-2",
      model: "Model-T",
      owner: user._id,
      ip: "192.168.1.100",
      status: "offline",
      components: []
    });

    await User.updateOne({ _id: user._id }, { $push: { devices: device._id } });

    const res = await request(app)
      .delete(`/api/device/${device._id.toString()}`)
      .query({ command: "remove" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Device Removed Successfully");

    // Verify DB updates
    const deletedDevice = await Devices.findById(device._id);
    expect(deletedDevice).toBeNull();

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.devices).not.toContain(device._id);
  });
});
