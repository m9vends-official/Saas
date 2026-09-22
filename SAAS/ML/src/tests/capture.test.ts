import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";

vi.mock("../config/DB.config.js", () => ({
  Mongo_Connect: vi.fn().mockResolvedValue(true),
}));

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

let app: any;

describe("Image Capture Receiver API (POST /capture)", () => {
  beforeAll(async () => {
    app = (await import("../app.js")).default;
  });

  // Valid JPEG header bytes: 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

  it("GET /capture should return 200 OK with HTML content", async () => {
    const res = await request(app).get("/capture");
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toMatch(/text\/html/);
  });

  it("POST /capture?deviceID=ESP32-001 with valid raw JPEG buffer should return 200 OK", async () => {
    const res = await request(app)
      .post("/capture?deviceID=ESP32-001")
      .set("Content-Type", "image/jpeg")
      .send(validJpegBuffer);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deviceID).toBe("ESP32-001");
    expect(res.body.imageSize).toBe(validJpegBuffer.length);
  });

  it("POST /capture without deviceID query param should default to 'unknown-device'", async () => {
    const res = await request(app)
      .post("/capture")
      .set("Content-Type", "image/jpeg")
      .send(validJpegBuffer);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deviceID).toBe("unknown-device");
  });

  it("POST /capture with invalid Content-Type should return 415", async () => {
    const res = await request(app)
      .post("/capture?deviceID=ESP32-001")
      .set("Content-Type", "application/json")
      .send({ text: "not a jpeg" });

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Unsupported Media Type");
  });

  it("POST /capture with empty body should return 400", async () => {
    const res = await request(app)
      .post("/capture?deviceID=ESP32-001")
      .set("Content-Type", "image/jpeg")
      .send(Buffer.alloc(0));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Empty image body");
  });

  it("POST /capture with non-JPEG binary data should return 400", async () => {
    const invalidBuffer = Buffer.from("THIS_IS_NOT_A_JPEG_FILE");
    const res = await request(app)
      .post("/capture?deviceID=ESP32-001")
      .set("Content-Type", "image/jpeg")
      .send(invalidBuffer);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Invalid JPEG image binary data");
  });
});
