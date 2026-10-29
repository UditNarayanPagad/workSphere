import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default("")
}).strict();

export const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).default(""),
  assigneeUserId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  dueDate: z.string().date().nullable().optional()
}).strict();

export const updateTaskDetailsSchema = z.object({
  assigneeUserId: z.string().regex(/^[a-f\d]{24}$/i).nullable(),
  dueDate: z.string().date().nullable()
}).strict();

export const updateTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"])
}).strict();

export const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000)
}).strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskDetailsInput = z.infer<typeof updateTaskDetailsSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
