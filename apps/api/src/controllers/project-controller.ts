import type { RequestHandler } from "express";
import {
  createProject,
  createTaskComment,
  createTask,
  listTaskComments,
  listProjects,
  listTasks,
  updateTaskDetails,
  updateTaskStatus
} from "../services/project-service.js";
import { routeParam } from "../utils/route-param.js";

export const listProjectsController: RequestHandler = async (request, response) => {
  const projects = await listProjects(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId)
  );
  response.status(200).json({ data: { projects } });
};

export const createProjectController: RequestHandler = async (request, response) => {
  const project = await createProject(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    request.body
  );
  response.status(201).json({ data: { project } });
};

export const listTasksController: RequestHandler = async (request, response) => {
  const tasks = await listTasks(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId)
  );
  response.status(200).json({ data: { tasks } });
};

export const createTaskController: RequestHandler = async (request, response) => {
  const task = await createTask(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId),
    request.body
  );
  response.status(201).json({ data: { task } });
};

export const updateTaskStatusController: RequestHandler = async (request, response) => {
  const task = await updateTaskStatus(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId),
    routeParam(request.params.taskId),
    request.body
  );
  response.status(200).json({ data: { task } });
};

export const updateTaskDetailsController: RequestHandler = async (request, response) => {
  const task = await updateTaskDetails(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId),
    routeParam(request.params.taskId),
    request.body
  );
  response.status(200).json({ data: { task } });
};

export const listTaskCommentsController: RequestHandler = async (request, response) => {
  const comments = await listTaskComments(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId),
    routeParam(request.params.taskId)
  );
  response.status(200).json({ data: { comments } });
};

export const createTaskCommentController: RequestHandler = async (request, response) => {
  const comment = await createTaskComment(
    response.locals.authUserId ?? "",
    routeParam(request.params.workspaceId),
    routeParam(request.params.projectId),
    routeParam(request.params.taskId),
    request.body
  );
  response.status(201).json({ data: { comment } });
};
