import { Schema, Types, model } from "mongoose";

export type NotificationType = "task_assigned" | "task_commented" | "workspace_joined";

export interface NotificationRecord {
  _id: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  type: NotificationType;
  message: string;
  resourceId: Types.ObjectId;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationRecord>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    type: {
      type: String,
      enum: ["task_assigned", "task_commented", "workspace_joined"],
      required: true
    },
    message: { type: String, required: true, maxlength: 300 },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export const Notification = model<NotificationRecord>("Notification", notificationSchema);
