import type { RequestHandler } from "express";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  createWorkspace,
  listWorkspaceInvitations,
  listWorkspaceMembers,
  listWorkspaces,
  revokeWorkspaceInvitation
} from "../services/workspace-service.js";

export const createWorkspaceController: RequestHandler = async (request, response) => {
  const workspace = await createWorkspace(response.locals.authUserId ?? "", request.body);
  response.status(201).json({ data: { workspace } });
};

export const listWorkspacesController: RequestHandler = async (_request, response) => {
  const workspaces = await listWorkspaces(response.locals.authUserId ?? "");
  response.status(200).json({ data: { workspaces } });
};

export const listWorkspaceMembersController: RequestHandler = async (request, response) => {
  const members = await listWorkspaceMembers(
    response.locals.authUserId ?? "",
    request.params.workspaceId ?? ""
  );
  response.status(200).json({ data: { members } });
};

export const createWorkspaceInvitationController: RequestHandler = async (request, response) => {
  const invitation = await createWorkspaceInvitation(
    response.locals.authUserId ?? "",
    request.params.workspaceId ?? "",
    request.body
  );
  response.status(201).json({ data: { invitation } });
};

export const listWorkspaceInvitationsController: RequestHandler = async (request, response) => {
  const invitations = await listWorkspaceInvitations(
    response.locals.authUserId ?? "",
    request.params.workspaceId ?? ""
  );
  response.status(200).json({ data: { invitations } });
};

export const revokeWorkspaceInvitationController: RequestHandler = async (request, response) => {
  await revokeWorkspaceInvitation(
    response.locals.authUserId ?? "",
    request.params.workspaceId ?? "",
    request.params.invitationId ?? ""
  );
  response.status(204).end();
};

export const acceptWorkspaceInvitationController: RequestHandler = async (request, response) => {
  const workspace = await acceptWorkspaceInvitation(
    response.locals.authUserId ?? "",
    request.body
  );
  response.status(200).json({ data: { workspace } });
};
