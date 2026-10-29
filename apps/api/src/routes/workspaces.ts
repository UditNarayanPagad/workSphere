import { Router } from "express";
import {
  createProjectController,
  createTaskCommentController,
  createTaskController,
  listTaskCommentsController,
  listProjectsController,
  listTasksController,
  updateTaskDetailsController,
  updateTaskStatusController
} from "../controllers/project-controller.js";
import {
  acceptWorkspaceInvitationController,
  createWorkspaceInvitationController,
  createWorkspaceController,
  listWorkspaceInvitationsController,
  listWorkspaceMembersController,
  listWorkspacesController,
  revokeWorkspaceInvitationController
} from "../controllers/workspace-controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validateBody } from "../middleware/validate-body.js";
import {
  acceptWorkspaceInvitationSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema
} from "../validation/workspace.js";
import {
  createProjectSchema,
  createTaskCommentSchema,
  createTaskSchema,
  updateTaskDetailsSchema,
  updateTaskStatusSchema
} from "../validation/project.js";

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);
workspacesRouter.post(
  "/invitations/accept",
  validateBody(acceptWorkspaceInvitationSchema),
  acceptWorkspaceInvitationController
);
workspacesRouter.get("/:workspaceId/projects", listProjectsController);
workspacesRouter.post(
  "/:workspaceId/projects",
  validateBody(createProjectSchema),
  createProjectController
);
workspacesRouter.get(
  "/:workspaceId/projects/:projectId/tasks",
  listTasksController
);
workspacesRouter.post(
  "/:workspaceId/projects/:projectId/tasks",
  validateBody(createTaskSchema),
  createTaskController
);
workspacesRouter.patch(
  "/:workspaceId/projects/:projectId/tasks/:taskId/details",
  validateBody(updateTaskDetailsSchema),
  updateTaskDetailsController
);
workspacesRouter.patch(
  "/:workspaceId/projects/:projectId/tasks/:taskId",
  validateBody(updateTaskStatusSchema),
  updateTaskStatusController
);
workspacesRouter.get(
  "/:workspaceId/projects/:projectId/tasks/:taskId/comments",
  listTaskCommentsController
);
workspacesRouter.post(
  "/:workspaceId/projects/:projectId/tasks/:taskId/comments",
  validateBody(createTaskCommentSchema),
  createTaskCommentController
);
workspacesRouter.post("/", validateBody(createWorkspaceSchema), createWorkspaceController);
workspacesRouter.get("/", listWorkspacesController);
workspacesRouter.get("/:workspaceId/members", listWorkspaceMembersController);
workspacesRouter.post(
  "/:workspaceId/invitations",
  validateBody(createWorkspaceInvitationSchema),
  createWorkspaceInvitationController
);
workspacesRouter.get("/:workspaceId/invitations", listWorkspaceInvitationsController);
workspacesRouter.delete(
  "/:workspaceId/invitations/:invitationId",
  revokeWorkspaceInvitationController
);
