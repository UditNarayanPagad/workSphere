import type { FormEventHandler } from "react";
import type { Project, Task, TaskComment, WorkspaceAnalytics, WorkspaceMember } from "../types";
import { isTaskStatus } from "../types";

export interface ProjectBoardProps {
  workspaceName: string | undefined;
  workspaceAnalytics: WorkspaceAnalytics | null;
  projects: Project[];
  selectedProjectId: string;
  projectName: string;
  tasks: Task[];
  workspaceMembers: WorkspaceMember[];
  activeTaskId: string;
  taskComments: TaskComment[];
  taskTitle: string;
  taskAssigneeId: string;
  taskDueDate: string;
  commentBody: string;
  isSubmitting: boolean;
  onClose: () => void;
  onCreateProject: FormEventHandler<HTMLFormElement>;
  onProjectNameChange: (name: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateTask: FormEventHandler<HTMLFormElement>;
  onTaskTitleChange: (title: string) => void;
  onTaskAssigneeChange: (memberId: string) => void;
  onTaskDueDateChange: (date: string) => void;
  onTaskStatusChange: (task: Task, status: Task["status"]) => void;
  onTaskDetailsChange: (
    task: Task,
    details: { assigneeUserId: string | null; dueDate: string | null }
  ) => void;
  onToggleTaskComments: (taskId: string) => void;
  onCreateComment: FormEventHandler<HTMLFormElement>;
  onCommentBodyChange: (body: string) => void;
}

export default function ProjectBoard({
  workspaceName,
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
  onClose,
  onCreateProject,
  onProjectNameChange,
  onSelectProject,
  onCreateTask,
  onTaskTitleChange,
  onTaskAssigneeChange,
  onTaskDueDateChange,
  onTaskStatusChange,
  onTaskDetailsChange,
  onToggleTaskComments,
  onCreateComment,
  onCommentBodyChange
}: ProjectBoardProps) {
  return (
    <section className="project-board" aria-label="Workspace projects and tasks">
      <div className="project-board__heading">
        <div>
          <p className="eyebrow">WORKSPACE BOARD</p>
          <h3>{workspaceName}</h3>
        </div>
        <button className="workspace-item__invite" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {workspaceAnalytics && (
        <section className="analytics-grid" aria-label="Workspace overview">
          <div><strong>{workspaceAnalytics.projectCount}</strong><span>Projects</span></div>
          <div><strong>{workspaceAnalytics.memberCount}</strong><span>Members</span></div>
          <div><strong>{workspaceAnalytics.taskCount}</strong><span>Tasks</span></div>
          <div className={workspaceAnalytics.overdueTaskCount ? "analytics-stat is-overdue" : "analytics-stat"}>
            <strong>{workspaceAnalytics.overdueTaskCount}</strong><span>Overdue</span>
          </div>
          <p>
            To do {workspaceAnalytics.tasksByStatus.todo}
            <span aria-hidden="true"> · </span>
            In progress {workspaceAnalytics.tasksByStatus.inProgress}
            <span aria-hidden="true"> · </span>
            Done {workspaceAnalytics.tasksByStatus.done}
          </p>
        </section>
      )}
      <form className="workspace-create" onSubmit={onCreateProject}>
        <label htmlFor="project-name">Create a project</label>
        <div className="workspace-create__controls">
          <input
            id="project-name"
            type="text"
            minLength={2}
            maxLength={120}
            placeholder="e.g. Website refresh"
            value={projectName}
            onChange={(event) => onProjectNameChange(event.target.value)}
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
            onChange={(event) => onSelectProject(event.target.value)}
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
                        onChange={(event) => onTaskDetailsChange(task, {
                          assigneeUserId: event.target.value || null,
                          dueDate: task.dueDate
                        })}
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
                        if (isTaskStatus(event.target.value)) onTaskStatusChange(task, event.target.value);
                      }}
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      className="task-card__comments"
                      type="button"
                      onClick={() => onToggleTaskComments(task.id)}
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
              <form className="workspace-create" onSubmit={onCreateComment}>
                <label htmlFor="task-comment">Add a comment</label>
                <div className="workspace-create__controls">
                  <input
                    id="task-comment"
                    type="text"
                    minLength={1}
                    maxLength={2000}
                    placeholder="Write a message…"
                    value={commentBody}
                    onChange={(event) => onCommentBodyChange(event.target.value)}
                    required
                  />
                  <button className="button" type="submit" disabled={isSubmitting}>Post</button>
                </div>
              </form>
            </section>
          )}
          <form className="workspace-create" onSubmit={onCreateTask}>
            <label htmlFor="task-title">Add a task</label>
            <div className="workspace-create__controls">
              <input
                id="task-title"
                type="text"
                minLength={2}
                maxLength={200}
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(event) => onTaskTitleChange(event.target.value)}
                required
              />
              <button className="button" type="submit" disabled={isSubmitting}>Add</button>
            </div>
            <label htmlFor="task-assignee">Assignee</label>
            <select
              id="task-assignee"
              className="project-select"
              value={taskAssigneeId}
              onChange={(event) => onTaskAssigneeChange(event.target.value)}
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
              onChange={(event) => onTaskDueDateChange(event.target.value)}
            />
          </form>
        </>
      )}
      {!projects.length && <p className="workspace-empty">Create a project to start a task board.</p>}
    </section>
  );
}
