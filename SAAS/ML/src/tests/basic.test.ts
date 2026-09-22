import request from "supertest";
import app from "../app.js";
import { describe, it, expect } from "vitest";

describe("Health Route", () => {

    it("should return 200 - server working properly", async () => {
        const response = await request(app).get("/");
        expect(response.status).toBe(200);
    });
});