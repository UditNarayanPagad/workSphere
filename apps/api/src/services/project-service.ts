import mongoose from "mongoose";
import { HttpError } from "../errors/http-error.js";
import { createNotification } from "./notification-service.js";
import { Project } from "../models/project.js";
import { TaskComment } from "../models/task-comment.js";
import { Task } from "../models/task.js";
import { User } from "../models/user.js";
import { WorkspaceMembership } from "../models/workspace-membership.js";
import type {
  CreateTaskCommentInput,
  CreateProjectInput,
  CreateTaskInput,
  UpdateTaskDetailsInput,
  UpdateTaskStatusInput
} from "../validation/project.js";

async function requireWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(workspaceId)) {
    throw new HttpError(404, "Workspace not found.");
  }

  const membership = await WorkspaceMembership.exists({ workspaceId, userId });
  if (!membership) throw new HttpError(404, "Workspace not found.");
}

async function requireProjectInWorkspace(workspaceId: string, projectId: string): Promise<void> {
  if (!mongoose.isValidObjectId(projectId)) throw new HttpError(404, "Project not found.");
  const projectExists = await Project.exists({ _id: projectId, workspaceId });
  if (!projectExists) throw new HttpError(404, "Project not found.");
}

async function requireTaskInWorkspace(
  workspaceId: string,
  projectId: string,
  taskId: string
): Promise<void> {
  if (!mongoose.isValidObjectId(taskId)) throw new HttpError(404, "Task not found.");
  const taskExists = await Task.exists({ _id: taskId, workspaceId, projectId });
  if (!taskExists) throw new HttpError(404, "Task not found.");
}

async function validateAssignee(workspaceId: string, assigneeUserId: string | null): Promise<void> {
  if (!assigneeUserId) return;
  const isMember = await WorkspaceMembership.exists({ workspaceId, userId: assigneeUserId });
  if (!isMember) throw new HttpError(400, "Assignee must be a member of this workspace.");
}

function toProjectSummary(project: {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
}) {
  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description,
    createdAt: project.createdAt
  };
}

function toTaskSummary(task: {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: string;
  assigneeUserId: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  createdAt: Date;
}) {
  return {
    id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    assigneeUserId: task.assigneeUserId?.toString() ?? null,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    createdAt: task.createdAt
  };
}

export async function listProjects(userId: string, workspaceId: string) {
  await requireWorkspaceMember(userId, workspaceId);
  const projects = await Project.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  return projects.map(toProjectSummary);
}

export async function createProject(
  userId: string,
  workspaceId: string,
  input: CreateProjectInput
) {
  await requireWorkspaceMember(userId, workspaceId);
  const project = await Project.create({
    workspaceId,
    name: input.name,
    description: input.description,
    createdBy: userId
  });
  return toProjectSummary(project);
}

export async function listTasks(userId: string, workspaceId: string, projectId: string) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  const tasks = await Task.find({ workspaceId, projectId }).sort({ createdAt: 1 }).lean();
  return tasks.map(toTaskSummary);
}

export async function createTask(
  userId: string,
  workspaceId: string,
  projectId: string,
  input: CreateTaskInput
) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  const assigneeUserId = input.assigneeUserId ?? null;
  await validateAssignee(workspaceId, assigneeUserId);
  const task = await Task.create({
    workspaceId,
    projectId,
    title: input.title,
    description: input.description,
    assigneeUserId,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    createdBy: userId
  });
  if (assigneeUserId) {
    await createNotification({
      recipientUserId: assigneeUserId,
      actorUserId: userId,
      workspaceId,
      type: "task_assigned",
      message: `You were assigned: ${task.title}`,
      resourceId: task._id
    });
  }
  return toTaskSummary(task);
}

export async function updateTaskDetails(
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskDetailsInput
) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  await requireTaskInWorkspace(workspaceId, projectId, taskId);
  await validateAssignee(workspaceId, input.assigneeUserId);

  const previousTask = await Task.findOne({ _id: taskId, workspaceId, projectId });
  if (!previousTask) throw new HttpError(404, "Task not found.");
  const task = await Task.findOneAndUpdate(
    { _id: taskId, workspaceId, projectId },
    {
      $set: {
        assigneeUserId: input.assigneeUserId,
        dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null
      }
    },
    { new: true, runValidators: true }
  );
  if (!task) throw new HttpError(404, "Task not found.");
  if (
    input.assigneeUserId &&
    input.assigneeUserId !== previousTask.assigneeUserId?.toString()
  ) {
    await createNotification({
      recipientUserId: input.assigneeUserId,
      actorUserId: userId,
      workspaceId,
      type: "task_assigned",
      message: `You were assigned: ${task.title}`,
      resourceId: task._id
    });
  }
  return toTaskSummary(task);
}

export async function updateTaskStatus(
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskStatusInput
) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  if (!mongoose.isValidObjectId(taskId)) throw new HttpError(404, "Task not found.");

  const task = await Task.findOneAndUpdate(
    { _id: taskId, workspaceId, projectId },
    { $set: { status: input.status } },
    { new: true, runValidators: true }
  );
  if (!task) throw new HttpError(404, "Task not found.");
  return toTaskSummary(task);
}

export async function listTaskComments(
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string
) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  await requireTaskInWorkspace(workspaceId, projectId, taskId);

  const comments = await TaskComment.find({ workspaceId, projectId, taskId })
    .sort({ createdAt: 1 })
    .lean();
  const authors = await User.find({
    _id: { $in: comments.map(({ authorUserId }) => authorUserId) }
  }).select("displayName").lean();
  const authorsById = new Map(authors.map((author) => [author._id.toString(), author]));

  return comments.map((comment) => ({
    id: comment._id.toString(),
    body: comment.body,
    createdAt: comment.createdAt,
    author: {
      id: comment.authorUserId.toString(),
      displayName: authorsById.get(comment.authorUserId.toString())?.displayName ?? "Former member"
    }
  }));
}

export async function createTaskComment(
  userId: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
  input: CreateTaskCommentInput
) {
  await requireWorkspaceMember(userId, workspaceId);
  await requireProjectInWorkspace(workspaceId, projectId);
  await requireTaskInWorkspace(workspaceId, projectId, taskId);

  const author = await User.findById(userId).select("displayName").lean();
  if (!author) throw new HttpError(401, "Authentication required.");
  const task = await Task.findOne({ _id: taskId, workspaceId, projectId });
  if (!task) throw new HttpError(404, "Task not found.");

  const comment = await TaskComment.create({
    workspaceId,
    projectId,
    taskId,
    authorUserId: userId,
    body: input.body
  });
  if (task.assigneeUserId) {
    await createNotification({
      recipientUserId: task.assigneeUserId,
      actorUserId: userId,
      workspaceId,
      type: "task_commented",
      message: `${author.displayName} commented on: ${task.title}`,
      resourceId: task._id
    });
  }

  return {
    id: comment._id.toString(),
    body: comment.body,
    createdAt: comment.createdAt,
    author: { id: userId, displayName: author.displayName }
  };
}
