import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "../src/app.js";
import { RefreshTokenSession } from "../src/models/refresh-token-session.js";
import { User } from "../src/models/user.js";

const origin = "http://localhost:5173";
let mongoServer: MongoMemoryServer;

function authCookie(response: request.Response): string {
  const cookie = response.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Expected refresh cookie to be set");
  return cookie.split(";")[0];
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RefreshTokenSession.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("authentication", () => {
  it("registers a user, hashes the password, and returns a short-lived access token", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email: "  Alex@example.com ",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("alex@example.com");
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");

    const user = await User.findOne({ email: "alex@example.com" }).select("+passwordHash");
    expect(user?.passwordHash).not.toBe("a-secure-password");
  });

  it("rejects invalid input and duplicate email registration", async () => {
    const invalid = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({ email: "bad-email", displayName: "A", password: "short" });
    expect(invalid.status).toBe(400);

    const payload = {
      email: "alex@example.com",
      displayName: "Alex Morgan",
      password: "a-secure-password"
    };
    await request(app).post("/api/v1/auth/register").set("Origin", origin).send(payload);
    const duplicate = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send(payload);
    expect(duplicate.status).toBe(409);
  });

  it("does not allow registration from an unapproved origin", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", "https://attacker.example")
      .send({
        email: "alex@example.com",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });

    expect(response.status).toBe(403);
  });

  it("logs in with valid credentials and rejects invalid credentials", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email: "alex@example.com",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });

    const valid = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email: "ALEX@example.com", password: "a-secure-password" });
    expect(valid.status).toBe(200);
    expect(valid.body.data.accessToken).toEqual(expect.any(String));

    const invalid = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email: "alex@example.com", password: "wrong-password" });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.message).toBe("Email or password is incorrect.");

    const unknownUser = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({ email: "unknown@example.com", password: "wrong-password" });
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.error.message).toBe("Email or password is incorrect.");
  });

  it("protects the current-user route and excludes credentials", async () => {
    const anonymous = await request(app).get("/api/v1/auth/me");
    expect(anonymous.status).toBe(401);

    const login = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email: "alex@example.com",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });
    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(profile.status).toBe(200);
    expect(profile.body.data.user).toEqual({
      id: expect.any(String),
      email: "alex@example.com",
      displayName: "Alex Morgan"
    });
  });

  it("rotates refresh tokens and revokes a token family after reuse", async () => {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email: "alex@example.com",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });
    const originalCookie = authCookie(registration);

    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", originalCookie);
    expect(rotated.status).toBe(200);
    const rotatedCookie = authCookie(rotated);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", originalCookie);
    expect(replay.status).toBe(401);

    const reusedCurrentToken = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", rotatedCookie);
    expect(reusedCurrentToken.status).toBe(401);
  });

  it("revokes the refresh session on logout", async () => {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .set("Origin", origin)
      .send({
        email: "alex@example.com",
        displayName: "Alex Morgan",
        password: "a-secure-password"
      });
    const cookie = authCookie(registration);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Origin", origin)
      .set("Cookie", cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Origin", origin)
      .set("Cookie", cookie);
    expect(refresh.status).toBe(401);
  });
});
