import { useEffect, useState, type FormEvent } from "react";
import AppHeader from "./components/AppHeader";
import AuthForm from "./components/AuthForm";
import WelcomeCopy from "./components/WelcomeCopy";
import WorkspaceDashboard from "./components/WorkspaceDashboard";
import type {
  ApiState,
  AuthMode,
  AuthSession,
  NotificationItem,
  Project,
  Task,
  TaskComment,
  Workspace,
  WorkspaceAnalytics,
  WorkspaceMember
} from "./types";

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
  const [workspaceAnalytics, setWorkspaceAnalytics] = useState<WorkspaceAnalytics | null>(null);
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
    const activeSession = session;
    async function loadWorkspacesAndAcceptInvite() {
      try {
        const response = await requestApi<{ workspaces: Workspace[] }>("workspaces", {
          method: "GET",
          accessToken: activeSession.accessToken
        });
        if (active && response) setWorkspaces(response.data.workspaces);

        const token = new URLSearchParams(window.location.search).get("invite");
        if (!token) return;

        const accepted = await requestApi<{ workspace: Workspace }>("workspaces/invitations/accept", {
          method: "POST",
          accessToken: activeSession.accessToken,
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
      setWorkspaceAnalytics(null);
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
    if (!session || !focusedWorkspaceId) {
      setWorkspaceAnalytics(null);
      return;
    }

    let active = true;
    requestApi<{ analytics: WorkspaceAnalytics }>(
      `workspaces/${focusedWorkspaceId}/analytics`,
      { method: "GET", accessToken: session.accessToken }
    )
      .then((response) => {
        if (active && response) setWorkspaceAnalytics(response.data.analytics);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "Could not load workspace analytics.");
      });

    return () => {
      active = false;
    };
  }, [session, focusedWorkspaceId, projects, tasks]);

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

  return (
    <main className={session ? "app-shell app-shell--workspace" : "app-shell"}>
      <AppHeader
        apiState={apiState}
        session={session}
        isSubmitting={isSubmitting}
        onLogout={() => void handleLogout()}
      />

      <section className={session ? "page-content page-content--workspace" : "page-content"}>
        {!session && <WelcomeCopy />}

        <section
          className={session ? "auth-card auth-card--workspace" : "auth-card"}
          aria-label={session ? "Workspace dashboard" : undefined}
          aria-labelledby={session ? undefined : "auth-heading"}
        >
          {isRestoring ? (
            <div className="auth-loading" role="status">Restoring your session…</div>
          ) : session ? (
            <WorkspaceDashboard
              displayName={session.user.displayName}
              notificationProps={{
                notifications,
                onRefresh: () => void handleRefreshNotifications(),
                onMarkRead: (notificationId) => void handleMarkNotificationRead(notificationId)
              }}
              workspaceProps={{
                workspaces,
                isLoadingWorkspaces,
                focusedWorkspaceId,
                selectedWorkspaceId,
                invitationEmail,
                invitationUrl,
                workspaceName,
                isSubmitting,
                onOpenWorkspace: (workspaceId) => {
                  setFocusedWorkspaceId(workspaceId);
                  setSelectedProjectId("");
                  setActiveTaskId("");
                },
                onInviteWorkspace: (workspaceId) => {
                  setSelectedWorkspaceId(workspaceId);
                  setInvitationUrl("");
                  setErrorMessage("");
                  setNotice("");
                },
                onInvitationEmailChange: setInvitationEmail,
                onCreateInvitation: handleCreateInvitation,
                onWorkspaceNameChange: setWorkspaceName,
                onCreateWorkspace: handleCreateWorkspace
              }}
              projectBoardProps={focusedWorkspaceId ? {
                workspaceName: workspaces.find(({ id }) => id === focusedWorkspaceId)?.name,
                workspaceAnalytics,
                projects,
                selectedProjectId,
                projectName,
                tasks,
                workspaceMembers,
                activeTaskId,
                taskComments,
                taskTitle,
                taskAssigneeId,
                taskDueDate,
                commentBody,
                isSubmitting,
                onClose: () => setFocusedWorkspaceId(""),
                onCreateProject: handleCreateProject,
                onProjectNameChange: setProjectName,
                onSelectProject: (projectId) => {
                  setSelectedProjectId(projectId);
                  setActiveTaskId("");
                },
                onCreateTask: handleCreateTask,
                onTaskTitleChange: setTaskTitle,
                onTaskAssigneeChange: setTaskAssigneeId,
                onTaskDueDateChange: setTaskDueDate,
                onTaskStatusChange: (task, status) => void handleTaskStatusChange(task, status),
                onTaskDetailsChange: (task, details) => void handleTaskDetailsChange(task, details),
                onToggleTaskComments: (taskId) => setActiveTaskId(taskId === activeTaskId ? "" : taskId),
                onCreateComment: handleCreateComment,
                onCommentBodyChange: setCommentBody
              } : null}
              errorMessage={errorMessage}
              notice={notice}
            />
          ) : (
            <AuthForm
              authMode={authMode}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              notice={notice}
              onAuthModeChange={changeAuthMode}
              onSubmit={handleSubmit}
            />
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
