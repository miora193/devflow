// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file creates a configured GitHub API client using Octokit.
//
// Octokit is GitHub's official JavaScript library.
// Instead of writing raw axios calls like:
//   axios.get('https://api.github.com/repos/owner/repo/pulls/42', {
//     headers: { Authorization: 'Bearer token' }
//   })
//
// We use Octokit which gives us clean typed methods like:
//   octokit.rest.pulls.get({ owner, repo, pull_number: 42 })
//
// The function below creates a new Octokit instance with a specific token.
// Different users connect different repos with different tokens.
// So we create a new client per request rather than one global client.
// ─────────────────────────────────────────────────────────────────────────────

import { Octokit } from '@octokit/rest'

// Creates an authenticated Octokit instance.
// token: the GitHub personal access token or OAuth token for this user
export function createGithubClient(token: string): Octokit {
  return new Octokit({
    // auth tells Octokit to add "Authorization: Bearer <token>" to every request
    auth: token,

    // Custom user agent — GitHub's API requires this to identify your app
    // Format: "AppName/version"
    userAgent: 'DevFlow/1.0.0',
  })
}

// Helper to split a full repo name into owner and repo parts.
// GitHub API calls always need owner and repo separately.
// e.g. "miora193/devflow" → { owner: "miora193", repo: "devflow" }
export function parseFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}