import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { HttpError } from "../errors/http-error.js";
import { User } from "../models/user.js";
import { WorkspaceInvitation } from "../models/workspace-invitation.js";
import { Workspace } from "../models/workspace.js";
import { WorkspaceMembership } from "../models/workspace-membership.js";
import type {
  AcceptWorkspaceInvitationInput,
  CreateWorkspaceInput,
  CreateWorkspaceInvitationInput
} from "../validation/workspace.js";
import { createNotification } from "./notification-service.js";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toWorkspaceSummary(workspace: {
  _id: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
}) {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    createdAt: workspace.createdAt
  };
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, "Authentication required.");
  }

  const workspace = await Workspace.create({
    name: input.name,
    createdBy: userId
  });

  try {
    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId,
      role: "owner"
    });
  } catch (error) {
    await Workspace.deleteOne({ _id: workspace._id });
    throw error;
  }

  return {
    ...toWorkspaceSummary(workspace),
    role: "owner" as const
  };
}

export async function listWorkspaces(userId: string) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, "Authentication required.");
  }

  const memberships = await WorkspaceMembership.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  const workspaces = await Workspace.find({
    _id: { $in: memberships.map(({ workspaceId }) => workspaceId) }
  }).lean();
  const workspacesById = new Map(workspaces.map((workspace) => [
    workspace._id.toString(),
    toWorkspaceSummary(workspace)
  ]));

  return memberships.flatMap((membership) => {
    const workspace = workspacesById.get(membership.workspaceId.toString());
    return workspace ? [{ ...workspace, role: membership.role }] : [];
  });
}

export async function listWorkspaceMembers(userId: string, workspaceId: string) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(workspaceId)) {
    throw new HttpError(404, "Workspace not found.");
  }

  const membership = await WorkspaceMembership.findOne({ workspaceId, userId }).lean();
  if (!membership) throw new HttpError(404, "Workspace not found.");

  const memberships = await WorkspaceMembership.find({ workspaceId })
    .sort({ createdAt: 1 })
    .lean();
  const users = await User.find({
    _id: { $in: memberships.map(({ userId: memberId }) => memberId) }
  }).select("email displayName").lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return memberships.flatMap((member) => {
    const user = usersById.get(member.userId.toString());
    return user
      ? [{
          id: user._id.toString(),
          email: user.email,
          displayName: user.displayName,
          role: member.role,
          joinedAt: member.createdAt
        }]
      : [];
  });
}

async function requireWorkspaceManager(userId: string, workspaceId: string): Promise<void> {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(workspaceId)) {
    throw new HttpError(404, "Workspace not found.");
  }

  const membership = await WorkspaceMembership.findOne({
    workspaceId,
    userId,
    role: { $in: ["owner", "admin"] }
  }).lean();
  if (!membership) throw new HttpError(404, "Workspace not found.");
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function createWorkspaceInvitation(
  userId: string,
  workspaceId: string,
  input: CreateWorkspaceInvitationInput
) {
  await requireWorkspaceManager(userId, workspaceId);

  const email = input.email.trim().toLowerCase();
  const invitedUser = await User.findOne({ email }).select("_id").lean();
  if (invitedUser) {
    const existingMembership = await WorkspaceMembership.exists({
      workspaceId,
      userId: invitedUser._id
    });
    if (existingMembership) throw new HttpError(409, "This user is already a workspace member.");
  }

  const now = new Date();
  const previousInvitation = await WorkspaceInvitation.findOne({
    workspaceId,
    email,
    status: "pending"
  });
  if (previousInvitation && previousInvitation.expiresAt > now) {
    throw new HttpError(409, "A pending invitation already exists for this email.");
  }
  if (previousInvitation) {
    await WorkspaceInvitation.updateOne(
      { _id: previousInvitation._id, status: "pending" },
      { $set: { status: "expired" } }
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
  try {
    const invitation = await WorkspaceInvitation.create({
      workspaceId,
      email,
      invitedBy: userId,
      tokenHash: hashInvitationToken(token),
      expiresAt
    });

    return {
      id: invitation._id.toString(),
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      token
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "A pending invitation already exists for this email.");
    }
    throw error;
  }
}

export async function listWorkspaceInvitations(userId: string, workspaceId: string) {
  await requireWorkspaceManager(userId, workspaceId);
  const now = new Date();
  await WorkspaceInvitation.updateMany(
    { workspaceId, status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "expired" } }
  );
  const invitations = await WorkspaceInvitation.find({
    workspaceId,
    status: "pending",
    expiresAt: { $gt: now }
  }).sort({ createdAt: -1 }).lean();

  return invitations.map((invitation) => ({
    id: invitation._id.toString(),
    email: invitation.email,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt
  }));
}

export async function revokeWorkspaceInvitation(
  userId: string,
  workspaceId: string,
  invitationId: string
): Promise<void> {
  await requireWorkspaceManager(userId, workspaceId);
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new HttpError(404, "Invitation not found.");
  }

  const revoked = await WorkspaceInvitation.findOneAndUpdate(
    { _id: invitationId, workspaceId, status: "pending" },
    { $set: { status: "revoked" } }
  );
  if (!revoked) throw new HttpError(404, "Invitation not found.");
}

export async function acceptWorkspaceInvitation(
  userId: string,
  input: AcceptWorkspaceInvitationInput
) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new HttpError(401, "Authentication required.");
  }

  const tokenHash = hashInvitationToken(input.token);
  const invitation = await WorkspaceInvitation.findOne({ tokenHash }).lean();
  if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
    if (invitation?.status === "pending") {
      await WorkspaceInvitation.updateOne(
        { _id: invitation._id, status: "pending", expiresAt: { $lte: new Date() } },
        { $set: { status: "expired" } }
      );
    }
    throw new HttpError(400, "Invitation is invalid, expired, or already used.");
  }

  const user = await User.findById(userId).select("email").lean();
  if (!user) throw new HttpError(401, "Authentication required.");
  if (user.email.trim().toLowerCase() !== invitation.email) {
    throw new HttpError(403, "This invitation was sent to a different email address.");
  }

  const claimed = await WorkspaceInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      tokenHash,
      status: "pending",
      expiresAt: { $gt: new Date() }
    },
    { $set: { status: "accepted", acceptedAt: new Date() } },
    { new: true }
  );
  if (!claimed) throw new HttpError(400, "Invitation is invalid, expired, or already used.");

  const workspace = await Workspace.findById(invitation.workspaceId).lean();
  if (!workspace) {
    await WorkspaceInvitation.updateOne(
      { _id: claimed._id, status: "accepted" },
      { $set: { status: "pending", acceptedAt: null } }
    );
    throw new HttpError(404, "Workspace not found.");
  }

  try {
    await WorkspaceMembership.create({
      workspaceId: workspace._id,
      userId,
      role: "member"
    });
  } catch (error) {
    await WorkspaceInvitation.updateOne(
      { _id: claimed._id, status: "accepted" },
      {
        $set: {
          status: isDuplicateKeyError(error) ? "revoked" : "pending",
          acceptedAt: null
        }
      }
    );
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "This user is already a workspace member.");
    }
    throw error;
  }

  const joiningUser = await User.findById(userId).select("displayName").lean();
  if (!joiningUser) throw new HttpError(401, "Authentication required.");
  await createNotification({
    recipientUserId: invitation.invitedBy,
    actorUserId: userId,
    workspaceId: workspace._id,
    type: "workspace_joined",
    message: `${joiningUser.displayName} joined ${workspace.name}`,
    resourceId: workspace._id
  });

  return {
    ...toWorkspaceSummary(workspace),
    role: "member" as const
  };
}
