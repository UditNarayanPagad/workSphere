import mongoose from "mongoose";
import { HttpError } from "../errors/http-error.js";
import { Notification } from "../models/notification.js";
import { User } from "../models/user.js";

export async function createNotification(input: {
  recipientUserId: mongoose.Types.ObjectId | string;
  actorUserId: mongoose.Types.ObjectId | string;
  workspaceId: mongoose.Types.ObjectId | string;
  type: "task_assigned" | "task_commented" | "workspace_joined";
  message: string;
  resourceId: mongoose.Types.ObjectId | string;
}): Promise<void> {
  if (input.recipientUserId.toString() === input.actorUserId.toString()) return;

  await Notification.create(input);
}

export async function listNotifications(userId: string) {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(401, "Authentication required.");

  const notifications = await Notification.find({ recipientUserId: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const actorIds = [...new Set(notifications.map(({ actorUserId }) => actorUserId.toString()))];
  const actors = await User.find({ _id: { $in: actorIds } }).select("displayName").lean();
  const actorsById = new Map(actors.map((actor) => [actor._id.toString(), actor.displayName]));

  return notifications.map((notification) => ({
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    workspaceId: notification.workspaceId.toString(),
    resourceId: notification.resourceId.toString(),
    actor: {
      id: notification.actorUserId.toString(),
      displayName: actorsById.get(notification.actorUserId.toString()) ?? "Former member"
    },
    readAt: notification.readAt,
    createdAt: notification.createdAt
  }));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(401, "Authentication required.");
  if (!mongoose.isValidObjectId(notificationId)) throw new HttpError(404, "Notification not found.");

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientUserId: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  if (!notification) {
    const alreadyRead = await Notification.exists({
      _id: notificationId,
      recipientUserId: userId
    });
    if (!alreadyRead) throw new HttpError(404, "Notification not found.");
  }
}
