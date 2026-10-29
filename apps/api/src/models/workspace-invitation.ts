import { Schema, Types, model } from "mongoose";

export type WorkspaceInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface WorkspaceInvitationRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  email: string;
  invitedBy: Types.ObjectId;
  tokenHash: string;
  status: WorkspaceInvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceInvitationSchema = new Schema<WorkspaceInvitationRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
      required: true
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

workspaceInvitationSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
workspaceInvitationSchema.index({ tokenHash: 1 }, { unique: true });

export const WorkspaceInvitation = model<WorkspaceInvitationRecord>(
  "WorkspaceInvitation",
  workspaceInvitationSchema
);
