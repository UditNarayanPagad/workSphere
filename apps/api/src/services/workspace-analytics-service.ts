import mongoose from "mongoose";
import { HttpError } from "../errors/http-error.js";
import { Project } from "../models/project.js";
import { Task } from "../models/task.js";
import { WorkspaceMembership } from "../models/workspace-membership.js";

export async function getWorkspaceAnalytics(userId: string, workspaceId: string) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(workspaceId)) {
    throw new HttpError(404, "Workspace not found.");
  }

  const membership = await WorkspaceMembership.exists({ workspaceId, userId });
  if (!membership) throw new HttpError(404, "Workspace not found.");

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [projectCount, memberCount, todoCount, inProgressCount, doneCount, overdueCount] =
    await Promise.all([
      Project.countDocuments({ workspaceId }),
      WorkspaceMembership.countDocuments({ workspaceId }),
      Task.countDocuments({ workspaceId, status: "todo" }),
      Task.countDocuments({ workspaceId, status: "in_progress" }),
      Task.countDocuments({ workspaceId, status: "done" }),
      Task.countDocuments({
        workspaceId,
        status: { $ne: "done" },
        dueDate: { $ne: null, $lt: today }
      })
    ]);

  return {
    projectCount,
    memberCount,
    taskCount: todoCount + inProgressCount + doneCount,
    tasksByStatus: {
      todo: todoCount,
      inProgress: inProgressCount,
      done: doneCount
    },
    overdueTaskCount: overdueCount
  };
}
