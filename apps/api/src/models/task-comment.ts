import { Schema, Types, model } from "mongoose";

export interface TaskCommentRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  taskId: Types.ObjectId;
  authorUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskCommentSchema = new Schema<TaskCommentRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, immutable: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, immutable: true },
    authorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 }
  },
  { timestamps: true }
);

taskCommentSchema.index({ workspaceId: 1, projectId: 1, taskId: 1, createdAt: 1 });

export const TaskComment = model<TaskCommentRecord>("TaskComment", taskCommentSchema);
