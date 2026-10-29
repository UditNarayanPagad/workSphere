import { Router } from "express";
import {
  listNotificationsController,
  markNotificationReadController
} from "../controllers/notification-controller.js";
import { requireAuth } from "../middleware/require-auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.get("/", listNotificationsController);
notificationsRouter.patch("/:notificationId/read", markNotificationReadController);
