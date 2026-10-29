import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100)
}).strict();

export const createWorkspaceInvitationSchema = z.object({
  email: z.string().trim().email().max(254)
}).strict();

export const acceptWorkspaceInvitationSchema = z.object({
  token: z.string().min(32).max(128)
}).strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateWorkspaceInvitationInput = z.infer<typeof createWorkspaceInvitationSchema>;
export type AcceptWorkspaceInvitationInput = z.infer<typeof acceptWorkspaceInvitationSchema>;
