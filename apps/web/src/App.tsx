import { useEffect, useState, type FormEvent } from "react";

type ApiState = "checking" | "online" | "offline";
type AuthMode = "login" | "register";

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthSession {
  user: User;
  accessToken: string;
}

interface Workspace {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  assigneeUserId: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface WorkspaceMember {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; displayName: string };
}

interface NotificationItem {
  id: string;
  type: "task_assigned" | "task_commented" | "workspace_joined";
  message: string;
  workspaceId: string;
  resourceId: string;
  actor: { id: string; displayName: string };
  readAt: string | null;
  createdAt: string;
}

function isTaskStatus(value: string): value is Task["status"] {
  return value === "todo" || value === "in_progress" || value === "done";
}

interface ApiResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
  };
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let sessionRestore: Promise<AuthSession | null> | undefined;

async function requestApi<T>(
  path: string,
  options: { method: "GET" | "POST" | "PATCH" | "DELETE"; accessToken?: string; body?: object }
): Promise<ApiResponse<T> | null> {
  const response = await fetch(`${apiUrl}/api/v1/${path}`, {
    method: options.method,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  if (!response.ok) {
    const payload = await response.json() as ApiErrorResponse;
    throw new Error(payload.error?.message ?? `Request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  return response.json() as Promise<ApiResponse<T>>;
}

function restoreSession(): Promise<AuthSession | null> {
  sessionRestore ??= requestApi<AuthSession>("auth/refresh", { method: "POST" })
    .then((response) => response?.data ?? null)
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "Authentication required.") return null;
      throw error;
    });

  return sessionRestore;
}

export default function App() {
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [invitationEmail, setInvitationEmail] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [focusedWorkspaceId, setFocusedWorkspaceId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [projectName, setProjectName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch(`${apiUrl}/api/v1/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
        if (active) setApiState("online");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (active) setApiState("offline");
      });

    restoreSession()
      .then((restoredSession) => {
        if (active) setSession(restoredSession);
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Could not restore your session.");
        }
      })
      .finally(() => {
        if (active) setIsRestoring(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setWorkspaces([]);
      setSelectedWorkspaceId("");
      setFocusedWorkspaceId("");
      setSelectedProjectId("");
      setInvitationUrl("");
      return;
    }

    let active = true;
    setIsLoadingWorkspaces(true);
    async function loadWorkspacesAndAcceptInvite() {
      try {
        const response = await requestApi<{ workspaces: Workspace[] }>("workspaces", {
          method: "GET",
          accessToken: session.accessToken
        });
        if (active && response) setWorkspaces(response.data.workspaces);

        const token = new URLSearchParams(window.location.search).get("invite");
        if (!token) return;

        const accepted = await requestApi<{ workspace: Workspace }>("workspaces/invitations/accept", {
          method: "POST",
          accessToken: session.accessToken,
          body: { token }
        });
        if (active && accepted) {
          setWorkspaces((current) => [
            accepted.data.workspace,
            ...current.filter(({ id }) => id !== accepted.data.workspace.id)
          ]);
          setNotice(`You joined ${accepted.data.workspace.name}.`);
          const inviteUrl = new URL(window.location.href);
          inviteUrl.searchParams.delete("invite");
          window.history.replaceState(null, "", inviteUrl.toString());
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Could not load your workspaces.");
        }
      } finally {
        if (active) setIsLoadingWorkspaces(false);
      }
    }

    void loadWorkspacesAndAcceptInvite();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      setNotifications([]);
      return;
    }

    let active = true;
    requestApi<{ notifications: NotificationItem[] }>("notifications", {
      method: "GET",
      accessToken: session.accessToken
    })
      .then((response) => {
        if (active && response) setNotifications(response.data.notifications);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Could not load notifications.");
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !focusedWorkspaceId) {
      setProjects([]);
      setWorkspaceMembers([]);
      setSelectedProjectId("");
      setTasks([]);
      setActiveTaskId("");
      return;
    }

    let active = true;
    Promise.all([
      requestApi<{ projects: Project[] }>(`workspaces/${focusedWorkspaceId}/projects`, {
        method: "GET",
        accessToken: session.accessToken
      }),
      requestApi<{ members: WorkspaceMember[] }>(`workspaces/${focusedWorkspaceId}/members`, {
        method: "GET",
        accessToken: session.accessToken
      })
    ])
      .then(([projectsResponse, membersResponse]) => {
        if (active && projectsResponse && membersResponse) {
          setProjects(projectsResponse.data.projects);
          setSelectedProjectId(projectsResponse.data.projects[0]?.id ?? "");
          setWorkspaceMembers(membersResponse.data.members);
        }
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Could not load projects.");
      });

    return () => {
      active = false;
    };
  }, [session, focusedWorkspaceId]);

  useEffect(() => {
    if (!session || !focusedWorkspaceId || !selectedProjectId) {
      setTasks([]);
      return;
    }

    let active = true;
    requestApi<{ tasks: Task[] }>(
      `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks`,
      { method: "GET", accessToken: session.accessToken }
    )
      .then((response) => {
        if (active && response) setTasks(response.data.tasks);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Could not load tasks.");
      });

    return () => {
      active = false;
    };
  }, [session, focusedWorkspaceId, selectedProjectId]);

  useEffect(() => {
    if (!session || !focusedWorkspaceId || !selectedProjectId || !activeTaskId) {
      setTaskComments([]);
      return;
    }

    let active = true;
    requestApi<{ comments: TaskComment[] }>(
      `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks/${activeTaskId}/comments`,
      { method: "GET", accessToken: session.accessToken }
    )
      .then((response) => {
        if (active && response) setTaskComments(response.data.comments);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Could not load comments.");
      });

    return () => {
      active = false;
    };
  }, [session, focusedWorkspaceId, selectedProjectId, activeTaskId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const response = await requestApi<AuthSession>(`auth/${authMode}`, { method: "POST", body });
      if (!response) throw new Error("The server returned an empty sign-in response.");
      setSession(response.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsSubmitting(true);
    setErrorMessage("");
    setNotice("");

    try {
      await requestApi("auth/logout", { method: "POST" });
      setNotice("You have been signed out.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign out.");
    } finally {
      setSession(null);
      setIsSubmitting(false);
    }
  }

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setNotice("");

    try {
      const response = await requestApi<{ workspace: Workspace }>("workspaces", {
        method: "POST",
        accessToken: session.accessToken,
        body: { name: workspaceName }
      });
      if (!response) throw new Error("The server returned an empty workspace response.");
      setWorkspaces((current) => [response.data.workspace, ...current]);
      setWorkspaceName("");
      setNotice("Your workspace is ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the workspace.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedWorkspaceId) return;

    setIsSubmitting(true);
    setErrorMessage("");
    setNotice("");

    try {
      const response = await requestApi<{ invitation: { token: string } }>(
        `workspaces/${selectedWorkspaceId}/invitations`,
        {
          method: "POST",
          accessToken: session.accessToken,
          body: { email: invitationEmail }
        }
      );
      if (!response) throw new Error("The server returned an empty invitation response.");
      const link = new URL(window.location.href);
      link.searchParams.set("invite", response.data.invitation.token);
      setInvitationUrl(link.toString());
      setInvitationEmail("");
      setNotice("Invitation link created. Share it with the invited person.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the invitation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !focusedWorkspaceId) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await requestApi<{ project: Project }>(
        `workspaces/${focusedWorkspaceId}/projects`,
        {
          method: "POST",
          accessToken: session.accessToken,
          body: { name: projectName }
        }
      );
      if (!response) throw new Error("The server returned an empty project response.");
      setProjects((current) => [response.data.project, ...current]);
      setSelectedProjectId(response.data.project.id);
      setProjectName("");
      setNotice("Project created.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !focusedWorkspaceId || !selectedProjectId) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await requestApi<{ task: Task }>(
        `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks`,
        {
          method: "POST",
          accessToken: session.accessToken,
          body: {
            title: taskTitle,
            assigneeUserId: taskAssigneeId || null,
            dueDate: taskDueDate || null
          }
        }
      );
      if (!response) throw new Error("The server returned an empty task response.");
      setTasks((current) => [...current, response.data.task]);
      setTaskTitle("");
      setTaskAssigneeId("");
      setTaskDueDate("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTaskStatusChange(task: Task, status: Task["status"]) {
    if (!session || !focusedWorkspaceId || !selectedProjectId) return;
    setErrorMessage("");

    try {
      const response = await requestApi<{ task: Task }>(
        `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks/${task.id}`,
        { method: "PATCH", accessToken: session.accessToken, body: { status } }
      );
      if (response) {
        setTasks((current) => current.map((item) => item.id === task.id ? response.data.task : item));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to move the task.");
    }
  }

  async function handleTaskDetailsChange(
    task: Task,
    details: { assigneeUserId: string | null; dueDate: string | null }
  ) {
    if (!session || !focusedWorkspaceId || !selectedProjectId) return;
    setErrorMessage("");

    try {
      const response = await requestApi<{ task: Task }>(
        `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks/${task.id}/details`,
        { method: "PATCH", accessToken: session.accessToken, body: details }
      );
      if (response) {
        setTasks((current) => current.map((item) => item.id === task.id ? response.data.task : item));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the task.");
    }
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !focusedWorkspaceId || !selectedProjectId || !activeTaskId) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await requestApi<{ comment: TaskComment }>(
        `workspaces/${focusedWorkspaceId}/projects/${selectedProjectId}/tasks/${activeTaskId}/comments`,
        { method: "POST", accessToken: session.accessToken, body: { body: commentBody } }
      );
      if (!response) throw new Error("The server returned an empty comment response.");
      setTaskComments((current) => [...current, response.data.comment]);
      setCommentBody("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to post the comment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    if (!session) return;
    setErrorMessage("");

    try {
      await requestApi(
        `notifications/${notificationId}/read`,
        { method: "PATCH", accessToken: session.accessToken }
      );
      setNotifications((current) => current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: new Date().toISOString() }
          : notification
      ));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to mark the notification as read.");
    }
  }

  async function handleRefreshNotifications() {
    if (!session) return;
    setErrorMessage("");

    try {
      const response = await requestApi<{ notifications: NotificationItem[] }>("notifications", {
        method: "GET",
        accessToken: session.accessToken
      });
      if (response) setNotifications(response.data.notifications);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not refresh notifications.");
    }
  }

  function changeAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setErrorMessage("");
    setNotice("");
  }

  const statusText = {
    checking: "Checking API connection",
    online: "API connected",
    offline: "API unavailable"
  }[apiState];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="WorkSphere home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>worksphere</span>
        </a>
        <div className={`service-status service-status--${apiState}`} role="status">
          <span className="service-status__dot" />
          {statusText}
        </div>
      </header>

      <section className="page-content">
        <div className="welcome-copy">
          <p className="eyebrow">TEAMWORK, IN ONE PLACE</p>
          <h1>Make good work happen.</h1>
          <p className="intro">
            Bring your projects, tasks, and team conversations together.
            Sign in to pick up where your team left off.
          </p>
          <div className="feature-note">
            <span className="feature-note__icon" aria-hidden="true">✦</span>
            <span>One clear space for everything your team is building.</span>
          </div>
        </div>

        <section className="auth-card" aria-labelledby="auth-heading">
          {isRestoring ? (
            <div className="auth-loading" role="status">Restoring your session…</div>
          ) : session ? (
            <div className="signed-in">
              <div className="signed-in__avatar" aria-hidden="true">
                {session.user.displayName.charAt(0).toUpperCase()}
              </div>
              <p className="eyebrow">YOU’RE SIGNED IN</p>
              <h2 id="auth-heading">Welcome, {session.user.displayName}.</h2>
              <p className="signed-in__email">{session.user.email}</p>
              <section className="notification-inbox" aria-label="Notifications">
                <div className="notification-inbox__heading">
                  <h3>Notifications</h3>
                  <div>
                    <span>{notifications.filter(({ readAt }) => !readAt).length} new</span>
                    <button type="button" onClick={handleRefreshNotifications}>Refresh</button>
                  </div>
                </div>
                {notifications.length ? (
                  <ul className="notification-list">
                    {notifications.slice(0, 5).map((notification) => (
                      <li
                        className={notification.readAt ? "notification-item" : "notification-item is-unread"}
                        key={notification.id}
                      >
                        <div>
                          <p>{notification.message}</p>
                          <time dateTime={notification.createdAt}>
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </time>
                        </div>
                        {!notification.readAt && (
                          <button
                            type="button"
                            className="notification-item__read"
                            onClick={() => handleMarkNotificationRead(notification.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="workspace-empty">You’re all caught up.</p>
                )}
              </section>
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
                          className="workspace-item__invite"
                          type="button"
                          onClick={() => {
                            setFocusedWorkspaceId(workspace.id);
                            setSelectedProjectId("");
                            setActiveTaskId("");
                          }}
                        >
                          Open
                        </button>
                        {workspace.role !== "member" && (
                          <button
                            className="workspace-item__invite"
                            type="button"
                            onClick={() => {
                              setSelectedWorkspaceId(workspace.id);
                              setInvitationUrl("");
                              setErrorMessage("");
                              setNotice("");
                            }}
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
                  <form className="workspace-create workspace-invite" onSubmit={handleCreateInvitation}>
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
                        onChange={(event) => setInvitationEmail(event.target.value)}
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
                <form className="workspace-create" onSubmit={handleCreateWorkspace}>
                  <label htmlFor="workspace-name">Create a workspace</label>
                  <div className="workspace-create__controls">
                    <input
                      id="workspace-name"
                      type="text"
                      minLength={2}
                      maxLength={100}
                      placeholder="e.g. Product team"
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      required
                    />
                    <button className="button" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Creating…" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
              {focusedWorkspaceId && (
                <section className="project-board" aria-label="Workspace projects and tasks">
                  <div className="project-board__heading">
                    <div>
                      <p className="eyebrow">WORKSPACE BOARD</p>
                      <h3>{workspaces.find(({ id }) => id === focusedWorkspaceId)?.name}</h3>
                    </div>
                    <button
                      className="workspace-item__invite"
                      type="button"
                      onClick={() => setFocusedWorkspaceId("")}
                    >
                      Close
                    </button>
                  </div>
                  <form className="workspace-create" onSubmit={handleCreateProject}>
                    <label htmlFor="project-name">Create a project</label>
                    <div className="workspace-create__controls">
                      <input
                        id="project-name"
                        type="text"
                        minLength={2}
                        maxLength={120}
                        placeholder="e.g. Website refresh"
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        required
                      />
                      <button className="button" type="submit" disabled={isSubmitting}>Add</button>
                    </div>
                  </form>
                  {projects.length > 0 && (
                    <>
                      <label className="project-select-label" htmlFor="project-select">Project</label>
                      <select
                        id="project-select"
                        className="project-select"
                        value={selectedProjectId}
                        onChange={(event) => {
                          setSelectedProjectId(event.target.value);
                          setActiveTaskId("");
                        }}
                      >
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                      </select>
                      <div className="kanban-board">
                        {(["todo", "in_progress", "done"] as const).map((status) => (
                          <section className="kanban-column" key={status}>
                            <h4>{status === "todo" ? "To do" : status === "in_progress" ? "In progress" : "Done"}</h4>
                            {tasks.filter((task) => task.status === status).map((task) => (
                              <article className="task-card" key={task.id}>
                                <span>{task.title}</span>
                                {task.assigneeUserId && (
                                  <span className="task-card__meta">
                                    {workspaceMembers.find(({ id }) => id === task.assigneeUserId)?.displayName ?? "Workspace member"}
                                  </span>
                                )}
                                {task.dueDate && <span className="task-card__meta">Due {task.dueDate}</span>}
                                <label>
                                  <span className="visually-hidden">Assignee for {task.title}</span>
                                  <select
                                    aria-label={`Assignee for ${task.title}`}
                                    value={task.assigneeUserId ?? ""}
                                    onChange={(event) => {
                                      void handleTaskDetailsChange(task, {
                                        assigneeUserId: event.target.value || null,
                                        dueDate: task.dueDate
                                      });
                                    }}
                                  >
                                    <option value="">Unassigned</option>
                                    {workspaceMembers.map((member) => (
                                      <option key={member.id} value={member.id}>{member.displayName}</option>
                                    ))}
                                  </select>
                                </label>
                                <select
                                  aria-label={`Move ${task.title}`}
                                  value={task.status}
                                  onChange={(event) => {
                                    if (isTaskStatus(event.target.value)) {
                                      void handleTaskStatusChange(task, event.target.value);
                                    }
                                  }}
                                >
                                  <option value="todo">To do</option>
                                  <option value="in_progress">In progress</option>
                                  <option value="done">Done</option>
                                </select>
                                <button
                                  className="task-card__comments"
                                  type="button"
                                  onClick={() => setActiveTaskId(task.id === activeTaskId ? "" : task.id)}
                                >
                                  {task.id === activeTaskId ? "Hide comments" : "Comments"}
                                </button>
                              </article>
                            ))}
                          </section>
                        ))}
                      </div>
                      {activeTaskId && (
                        <section className="task-comments" aria-label="Task comments">
                          <h4>Task conversation</h4>
                          {taskComments.map((comment) => (
                            <article className="task-comment" key={comment.id}>
                              <strong>{comment.author.displayName}</strong>
                              <p>{comment.body}</p>
                            </article>
                          ))}
                          {!taskComments.length && <p className="workspace-empty">No comments yet.</p>}
                          <form className="workspace-create" onSubmit={handleCreateComment}>
                            <label htmlFor="task-comment">Add a comment</label>
                            <div className="workspace-create__controls">
                              <input
                                id="task-comment"
                                type="text"
                                minLength={1}
                                maxLength={2000}
                                placeholder="Write a message…"
                                value={commentBody}
                                onChange={(event) => setCommentBody(event.target.value)}
                                required
                              />
                              <button className="button" type="submit" disabled={isSubmitting}>Post</button>
                            </div>
                          </form>
                        </section>
                      )}
                      <form className="workspace-create" onSubmit={handleCreateTask}>
                        <label htmlFor="task-title">Add a task</label>
                        <div className="workspace-create__controls">
                          <input
                            id="task-title"
                            type="text"
                            minLength={2}
                            maxLength={200}
                            placeholder="What needs to be done?"
                            value={taskTitle}
                            onChange={(event) => setTaskTitle(event.target.value)}
                            required
                          />
                          <button className="button" type="submit" disabled={isSubmitting}>Add</button>
                        </div>
                        <label htmlFor="task-assignee">Assignee</label>
                        <select
                          id="task-assignee"
                          className="project-select"
                          value={taskAssigneeId}
                          onChange={(event) => setTaskAssigneeId(event.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {workspaceMembers.map((member) => (
                            <option key={member.id} value={member.id}>{member.displayName}</option>
                          ))}
                        </select>
                        <label htmlFor="task-due-date">Due date</label>
                        <input
                          id="task-due-date"
                          className="project-select"
                          type="date"
                          value={taskDueDate}
                          onChange={(event) => setTaskDueDate(event.target.value)}
                        />
                      </form>
                    </>
                  )}
                  {!projects.length && <p className="workspace-empty">Create a project to start a task board.</p>}
                </section>
              )}
              {errorMessage && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
              {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
              <button className="button button--secondary" type="button" onClick={handleLogout} disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : "Sign out"}
              </button>
            </div>
          ) : (
            <>
              <div className="auth-card__heading">
                <p className="eyebrow">{authMode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
                <h2 id="auth-heading">{authMode === "login" ? "Sign in to WorkSphere" : "Create your account"}</h2>
                <p>{authMode === "login" ? "Your team is just a moment away." : "Start making good work happen."}</p>
              </div>

              <div className="auth-tabs" role="tablist" aria-label="Account action">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "login"}
                  className={authMode === "login" ? "auth-tabs__tab is-active" : "auth-tabs__tab"}
                  onClick={() => changeAuthMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === "register"}
                  className={authMode === "register" ? "auth-tabs__tab is-active" : "auth-tabs__tab"}
                  onClick={() => changeAuthMode("register")}
                >
                  Create account
                </button>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {authMode === "register" && (
                  <label>
                    <span>Your name</span>
                    <input
                      name="displayName"
                      type="text"
                      autoComplete="name"
                      minLength={2}
                      maxLength={80}
                      placeholder="Alex Morgan"
                      required
                    />
                  </label>
                )}
                <label>
                  <span>Email address</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@company.com"
                    required
                  />
                </label>
                <label>
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    minLength={authMode === "register" ? 12 : 1}
                    maxLength={128}
                    placeholder={authMode === "register" ? "At least 12 characters" : "Enter your password"}
                    required
                  />
                </label>

                {errorMessage && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
                {notice && <p className="form-message form-message--success" role="status">{notice}</p>}

                <button className="button" type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? (authMode === "login" ? "Signing in…" : "Creating account…")
                    : (authMode === "login" ? "Sign in" : "Create account")}
                  {!isSubmitting && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <p className="auth-card__footnote">
                {authMode === "login"
                  ? "Your session is protected with secure, httpOnly cookies."
                  : "By creating an account, you agree to work better together."}
              </p>
            </>
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span>© 2026 WorkSphere</span>
        <span>Project collaboration, made clearer.</span>
      </footer>
    </main>
  );
}
