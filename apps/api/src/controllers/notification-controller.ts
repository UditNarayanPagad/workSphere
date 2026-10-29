import type { RequestHandler } from "express";
import { listNotifications, markNotificationRead } from "../services/notification-service.js";

export const listNotificationsController: RequestHandler = async (_request, response) => {
  const notifications = await listNotifications(response.locals.authUserId ?? "");
  response.status(200).json({ data: { notifications } });
};

export const markNotificationReadController: RequestHandler = async (request, response) => {
  await markNotificationRead(
    response.locals.authUserId ?? "",
    request.params.notificationId ?? ""
  );
  response.status(204).end();
};
