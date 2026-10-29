import type { RequestHandler } from "express";
import { getWorkspaceAnalytics } from "../services/workspace-analytics-service.js";
import { routeParam } from "../utils/route-param.js";

export const workspaceAnalyticsController: RequestHandler = async (request, response) => {
  const analytics = await getWorkspaceAnalytics(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId)
  );
  response.status(200).json({ data: { analytics } });
};
