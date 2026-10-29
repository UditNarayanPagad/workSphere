import { Schema, Types, model } from "mongoose";

export interface ProjectRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  description: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectRecord>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, immutable: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true }
  },
  { timestamps: true }
);

projectSchema.index({ workspaceId: 1, createdAt: -1 });

export const Project = model<ProjectRecord>("Project", projectSchema);
