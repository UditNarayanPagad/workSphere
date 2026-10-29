import { Schema, Types, model } from "mongoose";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeUserId: Types.ObjectId | null;
  dueDate: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 4000, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
      required: true
    },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true }
  },
  { timestamps: true }
);

taskSchema.index({ workspaceId: 1, projectId: 1, status: 1, createdAt: -1 });

export const Task = model<TaskRecord>("Task", taskSchema);
