import { Schema, Types, model } from "mongoose";

export interface WorkspaceRecord {
  _id: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<WorkspaceRecord>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true }
  },
  { timestamps: true }
);

export const Workspace = model<WorkspaceRecord>("Workspace", workspaceSchema);
