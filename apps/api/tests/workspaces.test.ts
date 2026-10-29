import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { app } from "../src/app.js";
import { RefreshTokenSession } from "../src/models/refresh-token-session.js";
import { User } from "../src/models/user.js";
import { Workspace } from "../src/models/workspace.js";
import { WorkspaceInvitation } from "../src/models/workspace-invitation.js";
import { WorkspaceMembership } from "../src/models/workspace-membership.js";
import { Project } from "../src/models/project.js";
import { Task } from "../src/models/task.js";
import { TaskComment } from "../src/models/task-comment.js";
import { Notification } from "../src/models/notification.js";

const origin = "http://localhost:5173";
let mongoServer: MongoMemoryServer;

async function register(email: string, displayName: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", origin)
    .send({ email, displayName, password: "a-secure-password" });
  return response.body.data.accessToken as string;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RefreshTokenSession.deleteMany({}),
    Workspace.deleteMany({}),
    WorkspaceInvitation.deleteMany({}),
    WorkspaceMembership.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    TaskComment.deleteMany({}),
    Notification.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("workspaces", () => {
  it("creates a workspace with its creator as owner and lists it for that user", async () => {
    const token = await register("alex@example.com", "Alex Morgan");
    const created = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Product Team" });

    expect(created.status).toBe(201);
    expect(created.body.data.workspace).toMatchObject({
      id: expect.any(String),
      name: "Product Team",
      role: "owner"
    });

    const list = await request(app)
      .get("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.workspaces).toHaveLength(1);
    expect(list.body.data.workspaces[0]).toMatchObject({
      id: created.body.data.workspace.id,
      name: "Product Team",
      role: "owner"
    });
  });

  it("requires authentication and validates workspace names", async () => {
    const anonymous = await request(app).get("/api/v1/workspaces");
    expect(anonymous.status).toBe(401);

    const token = await register("alex@example.com", "Alex Morgan");
    const invalid = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "x", unexpected: true });

    expect(invalid.status).toBe(400);
    expect(await Workspace.countDocuments()).toBe(0);
  });

  it("returns workspace members only to an existing member", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const otherToken = await register("sam@example.com", "Sam Taylor");
    const created = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = created.body.data.workspace.id as string;

    const members = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(members.status).toBe(200);
    expect(members.body.data.members).toHaveLength(1);
    expect(members.body.data.members[0]).toMatchObject({
      email: "alex@example.com",
      displayName: "Alex Morgan",
      role: "owner"
    });

    const denied = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(denied.status).toBe(404);

    const hiddenFromList = await request(app)
      .get("/api/v1/workspaces")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(hiddenFromList.body.data.workspaces).toEqual([]);
  });

  it("creates single-use invitations and adds the matching user as a member", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const inviteeToken = await register("sam@example.com", "Sam Taylor");
    const otherToken = await register("lee@example.com", "Lee Jordan");
    const created = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = created.body.data.workspace.id as string;
    const invited = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: " SAM@example.com " });

    expect(invited.status).toBe(201);
    expect(invited.body.data.invitation).toMatchObject({
      email: "sam@example.com",
      token: expect.any(String),
      expiresAt: expect.any(String)
    });

    const storedInvitation = await WorkspaceInvitation.findById(
      invited.body.data.invitation.id
    ).select("+tokenHash");
    expect(storedInvitation?.tokenHash).not.toBe(invited.body.data.invitation.token);

    const duplicate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "sam@example.com" });
    expect(duplicate.status).toBe(409);

    const token = invited.body.data.invitation.token as string;
    const wrongAccount = await request(app)
      .post("/api/v1/workspaces/invitations/accept")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ token });
    expect(wrongAccount.status).toBe(403);

    const accepted = await request(app)
      .post("/api/v1/workspaces/invitations/accept")
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({ token });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.workspace).toMatchObject({
      id: workspaceId,
      name: "Product Team",
      role: "member"
    });
    const ownerNotifications = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(ownerNotifications.body.data.notifications).toHaveLength(1);
    expect(ownerNotifications.body.data.notifications[0]).toMatchObject({
      type: "workspace_joined",
      message: "Sam Taylor joined Product Team",
      actor: { displayName: "Sam Taylor" }
    });

    const replay = await request(app)
      .post("/api/v1/workspaces/invitations/accept")
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({ token });
    expect(replay.status).toBe(400);

    const members = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${inviteeToken}`);
    expect(members.body.data.members).toHaveLength(2);
  });

  it("restricts invitation management to owners and admins and supports revocation", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const memberToken = await register("sam@example.com", "Sam Taylor");
    const created = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = created.body.data.workspace.id as string;
    const member = await User.findOne({ email: "sam@example.com" });
    if (!member) throw new Error("Expected the test member to exist");
    await WorkspaceMembership.create({
      workspaceId,
      userId: member._id,
      role: "member"
    });

    const denied = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ email: "lee@example.com" });
    expect(denied.status).toBe(404);

    const createdInvitation = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "lee@example.com" });
    const invitationId = createdInvitation.body.data.invitation.id as string;

    const list = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(list.body.data.invitations).toHaveLength(1);
    expect(list.body.data.invitations[0]).not.toHaveProperty("token");

    const revoked = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(revoked.status).toBe(204);

    const cannotAccept = await request(app)
      .post("/api/v1/workspaces/invitations/accept")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ token: createdInvitation.body.data.invitation.token });
    expect(cannotAccept.status).toBe(400);
  });

  it("expires invitations after seven days", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const inviteeToken = await register("sam@example.com", "Sam Taylor");
    const created = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = created.body.data.workspace.id as string;
    const invitation = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "sam@example.com" });
    await WorkspaceInvitation.updateOne(
      { _id: invitation.body.data.invitation.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const expired = await request(app)
      .post("/api/v1/workspaces/invitations/accept")
      .set("Authorization", `Bearer ${inviteeToken}`)
      .send({ token: invitation.body.data.invitation.token });
    expect(expired.status).toBe(400);
    expect(await WorkspaceMembership.countDocuments({ workspaceId })).toBe(1);
  });

  it("creates workspace projects and project tasks and updates Kanban status", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const memberToken = await register("sam@example.com", "Sam Taylor");
    const createdWorkspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = createdWorkspace.body.data.workspace.id as string;
    const member = await User.findOne({ email: "sam@example.com" });
    if (!member) throw new Error("Expected the test member to exist");
    await WorkspaceMembership.create({ workspaceId, userId: member._id, role: "member" });

    const createdProject = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Website", description: "Public site refresh" });
    expect(createdProject.status).toBe(201);
    const projectId = createdProject.body.data.project.id as string;

    const task = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({
        title: "Design landing page",
        description: "Prepare first draft",
        assigneeUserId: member._id.toString(),
        dueDate: "2026-11-15"
      });
    expect(task.status).toBe(201);
    expect(task.body.data.task).toMatchObject({
      projectId,
      title: "Design landing page",
      status: "todo",
      assigneeUserId: member._id.toString(),
      dueDate: "2026-11-15"
    });
    const assignmentNotifications = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(assignmentNotifications.body.data.notifications).toHaveLength(1);
    expect(assignmentNotifications.body.data.notifications[0]).toMatchObject({
      type: "task_assigned",
      message: "You were assigned: Design landing page"
    });

    const moved = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.body.data.task.id}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ status: "in_progress" });
    expect(moved.status).toBe(200);
    expect(moved.body.data.task.status).toBe("in_progress");

    const listedTasks = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(listedTasks.body.data.tasks).toHaveLength(1);
    expect(listedTasks.body.data.tasks[0].status).toBe("in_progress");

    const comment = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.body.data.task.id}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ body: "First draft is ready for review." });
    expect(comment.status).toBe(201);
    expect(comment.body.data.comment).toMatchObject({
      body: "First draft is ready for review.",
      author: { displayName: "Alex Morgan" }
    });
    const commentNotifications = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(commentNotifications.body.data.notifications).toHaveLength(2);
    expect(commentNotifications.body.data.notifications[0]).toMatchObject({
      type: "task_commented",
      message: "Alex Morgan commented on: Design landing page"
    });

    const comments = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.body.data.task.id}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(comments.status).toBe(200);
    expect(comments.body.data.comments).toHaveLength(1);

    const details = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.body.data.task.id}/details`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeUserId: null, dueDate: null });
    expect(details.status).toBe(200);
    expect(details.body.data.task).toMatchObject({ assigneeUserId: null, dueDate: null });
  });

  it("only lets workspace members assign tasks to workspace members and comment on their tasks", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const outsiderToken = await register("lee@example.com", "Lee Jordan");
    const createdWorkspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = createdWorkspace.body.data.workspace.id as string;
    const project = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Website" });
    const projectId = project.body.data.project.id as string;
    const outsider = await User.findOne({ email: "lee@example.com" });
    if (!outsider) throw new Error("Expected the test outsider to exist");

    const invalidAssignee = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Prepare launch", assigneeUserId: outsider._id.toString() });
    expect(invalidAssignee.status).toBe(400);

    const task = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Prepare launch" });
    const taskId = task.body.data.task.id as string;
    const deniedComment = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ body: "Not a member" });
    expect(deniedComment.status).toBe(404);
    expect(await TaskComment.countDocuments()).toBe(0);
  });

  it("allows only notification recipients to read and mark their notifications", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const memberToken = await register("sam@example.com", "Sam Taylor");
    const outsiderToken = await register("lee@example.com", "Lee Jordan");
    const workspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Product Team" });
    const workspaceId = workspace.body.data.workspace.id as string;
    const member = await User.findOne({ email: "sam@example.com" });
    const outsider = await User.findOne({ email: "lee@example.com" });
    if (!member || !outsider) throw new Error("Expected test users to exist");
    await WorkspaceMembership.create({ workspaceId, userId: member._id, role: "member" });
    const project = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Website" });
    const task = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${project.body.data.project.id}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Build home page", assigneeUserId: member._id.toString() });
    const notification = await Notification.findOne({ recipientUserId: member._id });
    if (!notification) throw new Error("Expected an assignment notification to exist");
    const notificationId = notification._id.toString();

    const inaccessible = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(inaccessible.status).toBe(404);

    const markedRead = await request(app)
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${memberToken}`);
    expect(markedRead.status).toBe(204);
    const list = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(list.body.data.notifications[0].readAt).toEqual(expect.any(String));
    expect(task.status).toBe(201);
  });

  it("does not expose project or task resources to non-members or across workspaces", async () => {
    const ownerToken = await register("alex@example.com", "Alex Morgan");
    const outsiderToken = await register("lee@example.com", "Lee Jordan");
    const firstWorkspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "First Team" });
    const secondWorkspace = await request(app)
      .post("/api/v1/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Second Team" });
    const firstWorkspaceId = firstWorkspace.body.data.workspace.id as string;
    const secondWorkspaceId = secondWorkspace.body.data.workspace.id as string;
    const project = await request(app)
      .post(`/api/v1/workspaces/${firstWorkspaceId}/projects`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Secret project" });
    const projectId = project.body.data.project.id as string;

    const outsider = await request(app)
      .get(`/api/v1/workspaces/${firstWorkspaceId}/projects`)
      .set("Authorization", `Bearer ${outsiderToken}`);
    expect(outsider.status).toBe(404);

    const crossWorkspace = await request(app)
      .get(`/api/v1/workspaces/${secondWorkspaceId}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(crossWorkspace.status).toBe(404);

    const invalidStatus = await request(app)
      .patch(`/api/v1/workspaces/${firstWorkspaceId}/projects/${projectId}/tasks/507f1f77bcf86cd799439011`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "blocked" });
    expect(invalidStatus.status).toBe(400);
  });
});
