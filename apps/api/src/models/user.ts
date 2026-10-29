import { Schema, Types, model } from "mongoose";

export interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserRecord>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

export const User = model<UserRecord>("User", userSchema);
