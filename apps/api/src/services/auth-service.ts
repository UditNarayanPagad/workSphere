import { randomBytes, createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";
import { RefreshTokenSession } from "../models/refresh-token-session.js";
import { User, type UserRecord } from "../models/user.js";
import type { LoginInput, RegisterInput } from "../validation/auth.js";

const signingKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const refreshCookieName = "worksphere_refresh";
let dummyPasswordHash: Promise<string> | undefined;

type PublicUser = Pick<UserRecord, "_id" | "email" | "displayName">;

interface AuthResult {
  user: { id: string; email: string; displayName: string };
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);
  }

  return dummyPasswordHash;
}

async function createAccessToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + env.ACCESS_TOKEN_TTL_SECONDS)
    .sign(signingKey);
}

function toPublicUser(user: PublicUser): AuthResult["user"] {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName
  };
}

async function issueSession(user: PublicUser, familyId: string = randomUUID()): Promise<AuthResult> {
  const refreshToken = randomBytes(32).toString("base64url");
  const refreshTokenExpiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshTokenSession.create({
    userId: user._id,
    familyId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt
  });

  return {
    user: toPublicUser(user),
    accessToken: await createAccessToken(user._id.toString()),
    refreshToken,
    refreshTokenExpiresAt
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await User.create({
      email: input.email,
      displayName: input.displayName,
      passwordHash
    });

    return issueSession(user);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new HttpError(409, "An account with this email already exists.");
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select("+passwordHash");
  const passwordHash = user ? user.passwordHash : await getDummyPasswordHash();
  const validPassword = await bcrypt.compare(input.password, passwordHash);

  if (!user || !validPassword) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  return issueSession(user);
}

export async function refresh(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) {
    throw new HttpError(401, "Authentication required.");
  }

  const tokenHash = hashToken(refreshToken);
  const session = await RefreshTokenSession.findOne({ tokenHash }).select("+tokenHash");

  if (!session) {
    throw new HttpError(401, "Authentication required.");
  }

  if (session.revokedAt) {
    await RefreshTokenSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new HttpError(401, "Refresh token reuse detected. Please sign in again.");
  }

  if (session.expiresAt <= new Date()) {
    await RefreshTokenSession.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new HttpError(401, "Authentication required.");
  }

  const claimed = await RefreshTokenSession.findOneAndUpdate(
    { _id: session._id, tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: false }
  );

  if (!claimed) {
    await RefreshTokenSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new HttpError(401, "Authentication required.");
  }

  const user = await User.findById(session.userId);

  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }

  try {
    return await issueSession(user, session.familyId);
  } catch (error) {
    await RefreshTokenSession.updateMany(
      { familyId: session.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw error;
  }
}

export async function revokeRefreshToken(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  await RefreshTokenSession.updateOne(
    { tokenHash: hashToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function getCurrentUser(userId: string): Promise<AuthResult["user"]> {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, "Authentication required.");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new HttpError(401, "Authentication required.");
  }

  return toPublicUser(user);
}

export const authCookie = {
  name: refreshCookieName,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" as const : "lax" as const,
    path: "/api/v1/auth"
  }
};
