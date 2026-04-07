// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file defines the "shape" of every piece of data in our app.
// TypeScript uses these shapes to catch mistakes before the code runs.
//
// An "interface" is just a description — it says "this thing has these fields".
// No code runs here. It is purely a description for TypeScript to check against.
// ─────────────────────────────────────────────────────────────────────────────


// ── User ─────────────────────────────────────────────────────────────────────
// Every person who logs in via GitHub becomes a User in our database.
// "string" means text. "?" after a field name means it is optional.
export interface User {
  id: string          // our own internal ID we generate — e.g. "clx7abc123"
  githubId: string    // GitHub's own ID for this user — never changes
  username: string    // their GitHub username — e.g. "danisha"
  avatarUrl: string   // link to their GitHub profile photo
  email: string       // their email address
  createdAt: string   // when they first logged in — stored as a date string
  updatedAt: string   // when their profile was last updated
}


// ── Workspace ─────────────────────────────────────────────────────────────────
// A workspace is like a team or organisation inside DevFlow.
// One user can belong to many workspaces.
// Example: "Miora's Personal", "MIORA Store Team", "Client Project"
export interface Workspace {
  id: string          // our internal ID
  name: string        // display name — e.g. "MIORA Store Team"
  slug: string        // URL-safe name — e.g. "miora-store-team" (lowercase, dashes)
  ownerId: string     // the User.id of whoever created this workspace
  createdAt: string
}


// ── Role ──────────────────────────────────────────────────────────────────────
// A Role describes what a user is ALLOWED to do inside a workspace.
// This is called RBAC — Role-Based Access Control.
//
// "type X = 'a' | 'b' | 'c'" means X can ONLY be one of these exact strings.
// TypeScript will throw an error if you try to use any other string.
export type Role = 'owner' | 'admin' | 'member' | 'viewer'

// What each role means:
// owner  → created the workspace, can do everything, cannot be removed
// admin  → can manage members and settings, cannot delete the workspace
// member → can view and interact with PR data, cannot manage members
// viewer → read-only, cannot interact with anything


// ── WorkspaceMember ───────────────────────────────────────────────────────────
// This connects a User to a Workspace with a specific Role.
// In database terms this is called a "join table" — it sits between
// the Users table and the Workspaces table and links them.
export interface WorkspaceMember {
  id: string
  userId: string       // which User
  workspaceId: string  // which Workspace
  role: Role           // what role they have — must be one of the 4 above
  joinedAt: string     // when they joined this workspace
}


// ── AuthUser ──────────────────────────────────────────────────────────────────
// This is the shape of what our API returns after a successful login.
// It is a smaller version of User — only the fields the frontend needs
// to display in the header: avatar, username, email.
export interface AuthUser {
  id: string
  githubId: string
  username: string
  avatarUrl: string
  email: string
}


// ── ApiError ──────────────────────────────────────────────────────────────────
// When something goes wrong, every endpoint in our API returns this shape.
// Having one consistent error shape means the frontend always knows
// exactly how to read an error response.
export interface ApiError {
  error: string       // short machine-readable code — e.g. "NOT_AUTHENTICATED"
  message: string     // human-readable explanation — e.g. "Please log in first"
  statusCode: number  // HTTP status code — 401, 403, 404, 500, etc.
}