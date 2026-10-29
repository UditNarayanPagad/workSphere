import type { FormEventHandler } from "react";
import type { Workspace } from "../types";

export interface WorkspaceSectionProps {
  workspaces: Workspace[];
  isLoadingWorkspaces: boolean;
  focusedWorkspaceId: string;
  selectedWorkspaceId: string;
  invitationEmail: string;
  invitationUrl: string;
  workspaceName: string;
  isSubmitting: boolean;
  onOpenWorkspace: (workspaceId: string) => void;
  onInviteWorkspace: (workspaceId: string) => void;
  onInvitationEmailChange: (email: string) => void;
  onCreateInvitation: FormEventHandler<HTMLFormElement>;
  onWorkspaceNameChange: (name: string) => void;
  onCreateWorkspace: FormEventHandler<HTMLFormElement>;
}

export default function WorkspaceSection({
  workspaces,
  isLoadingWorkspaces,
  focusedWorkspaceId,
  selectedWorkspaceId,
  invitationEmail,
  invitationUrl,
  workspaceName,
  isSubmitting,
  onOpenWorkspace,
  onInviteWorkspace,
  onInvitationEmailChange,
  onCreateInvitation,
  onWorkspaceNameChange,
  onCreateWorkspace
}: WorkspaceSectionProps) {
  return (
    <div className="workspace-section">
      <div className="workspace-section__heading">
        <div>
          <p className="eyebrow">YOUR TEAM SPACES</p>
          <h3>Workspaces</h3>
        </div>
        <span className="workspace-count">{workspaces.length}</span>
      </div>
      {isLoadingWorkspaces ? (
        <p className="workspace-empty" role="status">Loading workspaces…</p>
      ) : workspaces.length ? (
        <ul className="workspace-list">
          {workspaces.map((workspace) => (
            <li className="workspace-item" key={workspace.id}>
              <span className="workspace-item__icon" aria-hidden="true">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
              <span className="workspace-item__details">
                <strong>{workspace.name}</strong>
                <span>{workspace.role}</span>
              </span>
              <button
                className={focusedWorkspaceId === workspace.id
                  ? "workspace-item__invite is-active"
                  : "workspace-item__invite"}
                type="button"
                aria-pressed={focusedWorkspaceId === workspace.id}
                disabled={focusedWorkspaceId === workspace.id}
                onClick={() => onOpenWorkspace(workspace.id)}
              >
                Open
              </button>
              {workspace.role !== "member" && (
                <button
                  className="workspace-item__invite"
                  type="button"
                  onClick={() => onInviteWorkspace(workspace.id)}
                >
                  Invite
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="workspace-empty">No workspaces yet. Create one to get started.</p>
      )}
      {selectedWorkspaceId && (
        <form className="workspace-create workspace-invite" onSubmit={onCreateInvitation}>
          <label htmlFor="invitation-email">
            Invite to {workspaces.find(({ id }) => id === selectedWorkspaceId)?.name}
          </label>
          <div className="workspace-create__controls">
            <input
              id="invitation-email"
              type="email"
              maxLength={254}
              placeholder="teammate@company.com"
              value={invitationEmail}
              onChange={(event) => onInvitationEmailChange(event.target.value)}
              required
            />
            <button className="button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create link"}
            </button>
          </div>
          {invitationUrl && (
            <label className="invitation-link">
              <span>One-time invitation link</span>
              <input
                type="url"
                aria-label="One-time invitation link"
                readOnly
                value={invitationUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
        </form>
      )}
      <form className="workspace-create" onSubmit={onCreateWorkspace}>
        <label htmlFor="workspace-name">Create a workspace</label>
        <div className="workspace-create__controls">
          <input
            id="workspace-name"
            type="text"
            minLength={2}
            maxLength={100}
            placeholder="e.g. Product team"
            value={workspaceName}
            onChange={(event) => onWorkspaceNameChange(event.target.value)}
            required
          />
          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
