import { Schema, Types, model } from "mongoose";

export interface RefreshTokenSessionRecord {
  _id: string;
  userId: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSessionSchema = new Schema<RefreshTokenSessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

refreshTokenSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenSession = model<RefreshTokenSessionRecord>(
  "RefreshTokenSession",
  refreshTokenSessionSchema
);
