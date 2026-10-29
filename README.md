# WorkSphere

WorkSphere is a team collaboration and project management application built with React, TypeScript, Express, and MongoDB. The MVP includes account authentication, workspace membership and invitations, project/task boards, comments, in-app notifications, and workspace analytics.

## Requirements

- Node.js 22 or newer and npm 10 or newer
- Docker Desktop for local MongoDB, or a MongoDB connection string

## Local development

1. Copy `.env.example` to `.env`. Replace `ACCESS_TOKEN_SECRET` with a unique random secret of at least 32 characters. Keep real credentials out of version control.
2. Start the local database with `docker compose up -d mongo`.
3. Install dependencies from the repository root with `npm install`.
4. Start the client and API with `npm run dev`.
5. Open <http://localhost:5173>. The API health indicator should report connected.

The API listens on port `4000`. Its liveness endpoint is `GET /api/v1/health`; readiness is `GET /api/v1/ready` and reports whether MongoDB is connected. The web app can point to another API origin using `VITE_API_URL` in `apps/web/.env`.

## Authentication API

- `POST /api/v1/auth/register` — validates email, display name, and a 12–128 character password; creates the account and session.
- `POST /api/v1/auth/login` — checks credentials and starts a session.
- `POST /api/v1/auth/refresh` — rotates the HttpOnly refresh cookie and issues a new short-lived access token.
- `POST /api/v1/auth/logout` — revokes the refresh session and clears its cookie.
- `GET /api/v1/auth/me` — returns the authenticated profile; send the short-lived access token in the `Authorization` header using the Bearer scheme.

Refresh tokens are random opaque values stored only as SHA-256 hashes in MongoDB. Rotation invalidates the previous token; reuse revokes the token family. Refresh/logout and credential-issuing routes require an exact allowlisted `Origin`. The refresh cookie is HttpOnly, scoped to the auth API path, and Secure in production. It uses SameSite=Lax in development and SameSite=None in production so a separately hosted frontend can send it; production therefore requires HTTPS. Keep access tokens in memory on the client; do not put them in localStorage. Passwords are hashed with bcrypt. Registration and login are rate limited.

The browser UI supports account creation, sign-in, session restoration through the refresh cookie, and sign-out. Access tokens remain in memory and are not persisted to browser storage.

## Workspaces API

- `POST /api/v1/workspaces` — creates a workspace and makes the authenticated user its owner.
- `GET /api/v1/workspaces` — lists only the authenticated user's workspaces and roles.
- `GET /api/v1/workspaces/:workspaceId/members` — lists workspace members for an existing member; non-members receive a not-found response.
- `POST /api/v1/workspaces/:workspaceId/invitations` — an owner or admin creates a seven-day invitation for an email address.
- `GET /api/v1/workspaces/:workspaceId/invitations` — an owner or admin lists pending invitations.
- `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId` — an owner or admin revokes a pending invitation.
- `POST /api/v1/workspaces/invitations/accept` — an authenticated user accepts an invitation using its token; their account email must match the invited address.

The browser workspace screen lists and creates workspaces, creates invitation links, and accepts an invitation when its recipient signs in. Since email delivery is not configured, the creator must share the link. Invitation tokens are returned only when created and stored as hashes; each link is single-use and expires after seven days.

## Projects and tasks API

- `GET /api/v1/workspaces/:workspaceId/projects` and `POST` — list or create a project within a workspace.
- `GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks` and `POST` — list or create tasks in a project.
- `PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId` — move a task to `todo`, `in_progress`, or `done`.
- `PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/details` — set or clear a task assignee and due date.
- `GET` and `POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments` — list or add comments to a task.

All project and task routes require workspace membership and verify that the project and task belong to the requested workspace. Assignees must also be workspace members. The browser workspace board supports project creation, adding tasks with assignees and due dates, changing task assignees, moving tasks across the three Kanban columns, and posting task comments.

## Workspace analytics

- `GET /api/v1/workspaces/:workspaceId/analytics` — returns project and member totals, task counts by status, total tasks, and overdue tasks. Access is limited to workspace members.

The workspace board shows these summary metrics. Overdue means a task has a due date before the current UTC calendar day and is not marked done.

## Notifications API

- `GET /api/v1/notifications` — returns the authenticated user's 50 most recent notifications.
- `PATCH /api/v1/notifications/:notificationId/read` — marks one of that user's notifications as read.

Notifications are generated for task assignments, comments on an assigned task, and workspace invitation acceptance. They are in-app only; email, browser push, and real-time delivery are not configured. The signed-in UI includes a notification inbox with a manual refresh action.

## Checks

- `npm run lint` — ESLint for both workspaces
- `npm run typecheck` — TypeScript checks for client, API, and API tests
- `npm test` — API integration tests using an isolated in-memory MongoDB
- `npm run build` — production builds
- `npm run check` — lint, typecheck, tests, and build

## Current status

- [x] TypeScript client and API workspace scaffolding
- [x] API environment validation, logging, CORS, security headers, and safe error responses
- [x] MongoDB connection and liveness/readiness endpoints
- [x] Local MongoDB Compose configuration and CI validation workflow
- [x] Registration, login, refresh rotation, logout, and authenticated current-user API
- [x] API integration tests covering authentication, workspaces, invitations, projects, tasks, comments, notifications, and analytics (18 tests)
- [x] Browser sign-in and account creation UI with refresh-cookie session restoration and in-memory access tokens
- [x] Workspace creation/listing, owner memberships, and member-only directory access
- [x] Expiring, single-use workspace invitations, acceptance, and revocation
- [x] Workspace-scoped projects, tasks, and Kanban status changes
- [x] In-app notifications for task and workspace events
- [x] Workspace analytics
- [ ] Browser end-to-end tests

The full `npm run check` command currently passes linting, API and web typechecks, all 18 API integration tests, and production builds. Persistent MongoDB/API startup and browser end-to-end testing still need verification in an environment with Docker or a MongoDB URI and browser test tooling.

## Configuration

See `.env.example` and `apps/web/.env.example`. The API refuses to start if its environment configuration is invalid or MongoDB cannot be reached. The health endpoint is a liveness check; readiness additionally requires an active MongoDB connection.
