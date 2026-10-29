import { Schema, Types, model } from "mongoose";

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMembershipRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceMembershipSchema = new Schema<WorkspaceMembershipRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "admin", "member"],
      required: true
    }
  },
  { timestamps: true }
);

workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMembershipSchema.index({ userId: 1, createdAt: -1 });

export const WorkspaceMembership = model<WorkspaceMembershipRecord>(
  "WorkspaceMembership",
  workspaceMembershipSchema
);
