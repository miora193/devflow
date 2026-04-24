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


// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — GitHub Data Types
// ─────────────────────────────────────────────────────────────────────────────

// ── Repository ────────────────────────────────────────────────────────────────
// A GitHub repository a workspace has connected to DevFlow.
export interface Repository {
  id:            string
  // GitHub's own numeric ID — never changes even if the repo is renamed
  githubId:      number
  // Full name includes owner: "myorg/myrepo"
  fullName:      string
  // Just the repo name: "myrepo"
  name:          string
  // The owner — a user or organisation
  owner:         string
  isPrivate:     boolean
  // Usually "main" or "master"
  defaultBranch: string
  workspaceId:   string
  // null means we have never synced this repo yet
  lastSyncedAt:  string | null
  createdAt:     string
}

// ── PullRequest ───────────────────────────────────────────────────────────────
// One pull request from a connected repository.
// We store a local copy so we can query it without calling GitHub every time.
export interface PullRequest {
  id:              string
  // GitHub's PR number — e.g. #42 — shown in the GitHub URL
  githubNumber:    number
  title:           string
  // open = in review | closed = closed without merging | merged = merged
  state:           'open' | 'closed' | 'merged'
  authorUsername:  string
  authorAvatarUrl: string
  // The branch the PR is merging INTO — usually "main"
  baseBranch:      string
  // The branch the PR is coming FROM — the feature branch
  headBranch:      string
  githubUrl:       string
  // Counts stored locally so we do not re-fetch constantly
  commentsCount:   number
  reviewsCount:    number
  changedFiles:    number
  additions:       number  // lines added (green in diff)
  deletions:       number  // lines removed (red in diff)
  // Timestamps from GitHub
  githubCreatedAt: string
  githubUpdatedAt: string
  githubMergedAt:  string | null  // null if not merged
  githubClosedAt:  string | null  // null if still open
  repositoryId:    string
  createdAt:       string
  updatedAt:       string
}

// ── Review ────────────────────────────────────────────────────────────────────
// A review left on a pull request.
export type ReviewState =
  | 'APPROVED'           // reviewer approved the changes
  | 'CHANGES_REQUESTED'  // reviewer asked for changes
  | 'COMMENTED'          // reviewer commented without approving or rejecting
  | 'DISMISSED'          // a previous review was dismissed by an admin

export interface Review {
  id:                  string
  githubId:            number
  state:               ReviewState
  reviewerUsername:    string
  reviewerAvatarUrl:   string
  body:                string
  githubSubmittedAt:   string
  pullRequestId:       string
  createdAt:           string
}

// ── BullMQ Job Payloads ───────────────────────────────────────────────────────
// These describe the data we put INTO the queue.
// The worker reads these to know what to do.

// Sync ALL pull requests for a repository (used on first connect)
export interface SyncRepoJobData {
  repositoryId: string
  workspaceId:  string
  // "owner/repo" format — used to call GitHub API
  fullName:     string
  // GitHub access token to authenticate the API call
  accessToken:  string
}

// Sync ONE pull request (used when a webhook fires for a single PR)
export interface SyncPRJobData {
  repositoryId: string
  workspaceId:  string
  fullName:     string
  // GitHub PR number e.g. 42
  prNumber:     number
  accessToken:  string
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — Analytics Types
// These describe the shape of data returned by the analytics API endpoints.
// Each type is designed to match exactly what the chart components expect.
// ─────────────────────────────────────────────────────────────────────────────


// ── CycleTimePoint ────────────────────────────────────────────────────────────
// One data point on the cycle time scatter plot.
// Each dot on the chart represents one merged pull request.
export interface CycleTimePoint {
  // The PR number — shown in tooltip when user hovers over the dot
  prNumber: number

  // The PR title — shown in tooltip
  title: string

  // When the PR was opened — used as the X axis (horizontal position)
  // ISO date string e.g. "2026-03-15T10:30:00.000Z"
  openedAt: string

  // How many hours from open to merge — used as Y axis (vertical position)
  // We use hours (not days) so short PRs show meaningful differences
  cycleTimeHours: number

  // Also store days for display in tooltips (easier to read than 48 hours)
  cycleTimeDays: number

  // Who opened the PR — used to colour dots by author in the chart
  authorUsername: string
}

// The full response from GET /analytics/:repoId/cycle-time
export interface CycleTimeData {
  points: CycleTimePoint[]

  // Summary stats shown in the header above the chart
  averageCycleTimeDays: number
  medianCycleTimeDays:  number
  totalMergedPRs:       number
}


// ── VelocityPoint ─────────────────────────────────────────────────────────────
// One data point on the velocity area chart.
// Each point represents one week of work.
export interface VelocityPoint {
  // The Monday of this week — used as X axis label
  // Format: "Jan 15" for display, full ISO string internally
  weekStart:   string
  weekLabel:   string  // e.g. "Jan 15"

  // How many PRs were MERGED this week — the main metric
  merged: number

  // How many PRs were OPENED this week — shown as a secondary line
  opened: number
}

// The full response from GET /analytics/:repoId/velocity
export interface VelocityData {
  points: VelocityPoint[]

  // How many weeks of data we have
  weeksOfData: number

  // Average PRs merged per week across all weeks
  averageMergedPerWeek: number
}


// ── ReviewDepthPoint ──────────────────────────────────────────────────────────
// One bar in the review depth bar chart.
// Each bar represents one PR author.
export interface ReviewDepthPoint {
  // The GitHub username — used as X axis label
  authorUsername: string

  // Total PRs this author opened in the time range
  totalPRs: number

  // Average number of review comments per PR for this author
  avgComments: number

  // Average number of formal reviews per PR
  avgReviews: number

  // Average number of review CYCLES (changes requested + re-review)
  // Higher = PR needed more back-and-forth before being approved
  avgChangesRequested: number
}

// The full response from GET /analytics/:repoId/review-depth
export interface ReviewDepthData {
  authors: ReviewDepthPoint[]
  totalPRsAnalysed: number
}


// ── HeatmapDay ────────────────────────────────────────────────────────────────
// One square in the calendar heatmap.
// Each square represents one day of the year.
export interface HeatmapDay {
  // The date — "2026-03-15"
  date: string

  // How many PRs were opened or updated this day
  count: number

  // 0 = no activity, 1 = low, 2 = medium, 3 = high, 4 = very high
  // Pre-calculated intensity level used to pick the square colour
  intensity: 0 | 1 | 2 | 3 | 4
}

// The full response from GET /analytics/:repoId/heatmap
export interface HeatmapData {
  days: HeatmapDay[]

  // The most PRs opened in a single day (used to calculate intensity levels)
  maxCount: number

  // Total PRs in the date range
  totalPRs: number
}