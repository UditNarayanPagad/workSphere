import type { NotificationInboxProps } from "./NotificationInbox";
import NotificationInbox from "./NotificationInbox";
import type { ProjectBoardProps } from "./ProjectBoard";
import ProjectBoard from "./ProjectBoard";
import type { WorkspaceSectionProps } from "./WorkspaceSection";
import WorkspaceSection from "./WorkspaceSection";

interface WorkspaceDashboardProps {
  displayName: string;
  notificationProps: NotificationInboxProps;
  workspaceProps: WorkspaceSectionProps;
  projectBoardProps: ProjectBoardProps | null;
  errorMessage: string;
  notice: string;
}

export default function WorkspaceDashboard({
  displayName,
  notificationProps,
  workspaceProps,
  projectBoardProps,
  errorMessage,
  notice
}: WorkspaceDashboardProps) {
  return (
    <div className="signed-in">
      <div className="workspace-welcome">
        <div>
          <p className="eyebrow">YOUR TEAM SPACE</p>
          <h1>Welcome back, {displayName}.</h1>
          <p>Pick up where your team left off.</p>
        </div>
      </div>
      <NotificationInbox {...notificationProps} />
      <WorkspaceSection {...workspaceProps} />
      {projectBoardProps && <ProjectBoard {...projectBoardProps} />}
      {errorMessage && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
      {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
    </div>
  );
}
