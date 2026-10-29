export type ApiState = "checking" | "online" | "offline";
export type AuthMode = "login" | "register";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

export interface Workspace {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  assigneeUserId: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface WorkspaceAnalytics {
  projectCount: number;
  memberCount: number;
  taskCount: number;
  tasksByStatus: { todo: number; inProgress: number; done: number };
  overdueTaskCount: number;
}

export interface WorkspaceMember {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
}

export interface NotificationItem {
  id: string;
  type: "task_assigned" | "task_commented" | "workspace_joined";
  message: string;
  workspaceId: string;
  resourceId: string;
  actor: { id: string; displayName: string };
  readAt: string | null;
  createdAt: string;
}

export function isTaskStatus(value: string): value is Task["status"] {
  return value === "todo" || value === "in_progress" || value === "done";
}
