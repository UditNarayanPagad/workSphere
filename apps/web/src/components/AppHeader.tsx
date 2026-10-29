import type { ApiState, AuthSession } from "../types";

interface AppHeaderProps {
  apiState: ApiState;
  session: AuthSession | null;
  isSubmitting: boolean;
  onLogout: () => void;
}

const statusTextByState: Record<ApiState, string> = {
  checking: "Checking API connection",
  online: "API connected",
  offline: "API unavailable"
};

export default function AppHeader({ apiState, session, isSubmitting, onLogout }: AppHeaderProps) {
  return (
    <header className={session ? "topbar topbar--workspace" : "topbar"}>
      <a className="brand" href="/" aria-label="WorkSphere home">
        <span className="brand-mark" aria-hidden="true">W</span>
        <span>worksphere</span>
      </a>
      <div className={`service-status service-status--${apiState}`} role="status">
        <span className="service-status__dot" />
        {statusTextByState[apiState]}
      </div>
      {session && (
        <div className="profile-menu">
          <div className="profile-menu__avatar" aria-hidden="true">
            {session.user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="profile-menu__identity">
            <strong>{session.user.displayName}</strong>
            <span>{session.user.email}</span>
          </div>
          <button
            className="profile-menu__signout"
            type="button"
            onClick={onLogout}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </header>
  );
}
