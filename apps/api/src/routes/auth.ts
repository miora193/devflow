// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS THIS FILE?
// This file handles everything related to authentication:
//   - Redirecting users to GitHub to log in
//   - Handling the callback after GitHub approves
//   - Saving the user to our database
//   - Creating a JWT and storing it in a cookie
//   - Checking if someone is currently logged in (/auth/me)
//   - Logging out
// ─────────────────────────────────────────────────────────────────────────────

// Router is how Express lets us group related routes into separate files.
// Instead of putting all routes in index.ts, we create a Router here
// and register it in index.ts with: app.use('/auth', authRouter)
import express, { Router, Request, Response } from 'express'

// axios is a library for making HTTP requests from Node.js.
// We use it to call the GitHub API.
import axios from 'axios'

// jsonwebtoken lets us create and verify JWTs.
// A JWT is a signed token that proves who the user is.
import jwt from 'jsonwebtoken'

// Import our shared prisma instance from index.ts
// This is the same database connection the whole app uses.
import { prisma } from '../index'

// Import the AuthUser type we defined in packages/types
// This ensures the shape of our JWT payload matches what the frontend expects.
import type { AuthUser } from '@devflow/types'

// Create a new Router instance.
// All routes defined below will be prefixed with /auth (set in index.ts).
const router: express.Router = Router()


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 1: GET /auth/github
// The user clicks "Login with GitHub" on the frontend.
// The frontend link points to http://localhost:4000/auth/github
// This route builds a GitHub URL and redirects the user there.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/github', (_req: Request, res: Response) => {

  // URLSearchParams builds a query string safely.
  // The result looks like: client_id=xxx&scope=yyy&redirect_uri=zzz
  const params = new URLSearchParams({
    // client_id tells GitHub which app is asking for permission
    client_id: process.env.GITHUB_CLIENT_ID!,

    // redirect_uri is where GitHub sends the user AFTER they approve.
    // This must exactly match what you registered on GitHub.
    redirect_uri: 'http://localhost:4000/auth/github/callback',

    // scope is what permissions we are asking for.
    // read:user = read their profile (username, avatar)
    // user:email = read their email address
    scope: 'read:user user:email',
  })

  // Redirect the user's browser to GitHub's login/permission page.
  // From here, GitHub takes over completely.
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 2: GET /auth/github/callback
// After the user approves on GitHub, GitHub redirects them back here
// with a one-time code in the URL: /auth/github/callback?code=abc123
// We exchange that code for a real access token, get the user's profile,
// save them to the database, create a JWT, and redirect to the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/github/callback', async (req: Request, res: Response) => {

  // Extract the code from the URL query string
  // req.query contains everything after the ? in the URL
  const { code } = req.query

  // If there is no code, something went wrong — send them back to login
  if (!code || typeof code !== 'string') {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`)
  }

  try {

    // ── Step 1: Exchange the code for an access token ────────────────────────
    // We send the code + our secret to GitHub.
    // GitHub verifies everything is legitimate and sends back an access token.
    // This happens server-to-server — the user's browser is not involved here.
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        // Tell GitHub to respond with JSON instead of the default URL-encoded format
        headers: { Accept: 'application/json' }
      }
    )

    const accessToken: string = tokenResponse.data.access_token

    // If we did not get a token, GitHub rejected our request
    if (!accessToken) {
      console.error('GitHub token exchange failed:', tokenResponse.data)
      return res.redirect(`${process.env.CLIENT_URL}/login?error=token_exchange_failed`)
    }


    // ── Step 2: Fetch the user's GitHub profile ──────────────────────────────
    // Use the access token to ask GitHub "who is this person?"
    const profileResponse = await axios.get('https://api.github.com/user', {
      headers: {
        // Bearer token authentication — this proves we have permission to read their data
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    })
    const githubUser = profileResponse.data


    // ── Step 3: Fetch the user's email separately ────────────────────────────
    // GitHub profile does not always include email (users can hide it).
    // The /user/emails endpoint gives us their verified emails.
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    // Find the email marked as primary — that is the main one
    const primaryEmail = emailsResponse.data.find(
      (e: { primary: boolean; email: string }) => e.primary
    )?.email || githubUser.email || ''


    // ── Step 4: Save the user to our database ────────────────────────────────
    // "upsert" means: UPDATE if exists, INSERT if not.
    // This handles both first-time login and returning users in one operation.
    // We use githubId as the unique identifier — it never changes even if
    // the user renames their GitHub account.
    const user = await prisma.user.upsert({
      // where: which record to look for
      where: { githubId: String(githubUser.id) },

      // update: if the user EXISTS, update these fields
      // (their username or avatar might have changed on GitHub)
      update: {
        username:  githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email:     primaryEmail,
      },

      // create: if the user does NOT exist, create a new record with these fields
      create: {
        githubId:  String(githubUser.id),
        username:  githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email:     primaryEmail,
      },
    })


    // ── Step 5: Create a default workspace for first-time users ──────────────
    // Check if this user already has a workspace.
    // If not, create one for them automatically.
    const existingWorkspace = await prisma.workspace.findFirst({
      where: { ownerId: user.id },
    })

    if (!existingWorkspace) {
      // Create a URL-safe slug from their username.
      // e.g. "Danisha Soobhen" → "danisha-soobhen"
      // toLowerCase converts to lowercase.
      // replace removes anything that is not a letter, number, or hyphen.
      const slug = user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')  // replace special chars with hyphens
        .replace(/-+/g, '-')          // collapse multiple hyphens into one
        .replace(/^-|-$/g, '')        // remove leading/trailing hyphens

      const workspace = await prisma.workspace.create({
        data: {
          name:    `${user.username}'s workspace`,
          slug:    slug,
          ownerId: user.id,
        },
      })

      // Add the user as owner of their own workspace
      await prisma.workspaceMember.create({
        data: {
          userId:      user.id,
          workspaceId: workspace.id,
          role:        'owner',  // they created it so they are the owner
        },
      })
    }


    // ── Step 6: Create a JWT ─────────────────────────────────────────────────
    // A JWT is a signed token. It contains the user's basic info.
    // "Signed" means we use our JWT_SECRET to stamp it.
    // The server can verify the stamp later to confirm it was not faked.
    const payload: AuthUser = {
      id:        user.id,
      githubId:  user.githubId,
      username:  user.username,
      avatarUrl: user.avatarUrl,
      email:     user.email,
    }

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET!,  // the secret key used to sign it
      { expiresIn: '7d' }       // token expires in 7 days
    )


    // ── Step 7: Store the JWT in an httpOnly cookie ───────────────────────────
    // An httpOnly cookie is sent automatically with every request by the browser.
    // JavaScript on the page CANNOT read it — this protects against XSS attacks.
    res.cookie('auth_token', token, {
      httpOnly: true,   // JS cannot read this — security feature

      // secure: true means "only send over HTTPS".
      // In development we use HTTP so this must be false.
      // In production it MUST be true.
      secure: process.env.NODE_ENV === 'production',

      // sameSite: 'lax' means the cookie is sent on:
      // - same-origin requests (our React app calling our API)
      // - top-level navigations (the redirect after OAuth)
      // But NOT on cross-origin requests from other websites.
      // This protects against CSRF attacks.
      sameSite: 'lax',

      // maxAge is in milliseconds. 7 days = 7 * 24 * 60 * 60 * 1000
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    // Redirect the user to the dashboard — they are now logged in
    return res.redirect(`${process.env.CLIENT_URL}/dashboard`)

  } catch (error) {
    // Log the full error for debugging
    console.error('GitHub OAuth error:', error)

    // Send the user back to login with an error message
    return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`)
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 3: GET /auth/me
// The React app calls this on every page load to check:
// "Is there a valid auth cookie? If yes, who is this user?"
// React Query caches the result so it only re-fetches when needed.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', (req: Request, res: Response) => {

  // Read the auth_token cookie from the request.
  // req.cookies is populated by the cookie-parser middleware in index.ts.
  const token = req.cookies?.auth_token

  // No cookie means not logged in
  if (!token) {
    return res.status(401).json({
      error: 'NOT_AUTHENTICATED',
      message: 'No session found. Please log in.',
      statusCode: 401,
    })
  }

  try {
    // jwt.verify checks that:
    // 1. The token was signed with our JWT_SECRET (not faked)
    // 2. The token has not expired
    // If either check fails, it throws an error.
    const user = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser

    // Return the user's data to the React app
    return res.json(user)

  } catch (error) {
    // Token is invalid or expired — clear the bad cookie
    res.clearCookie('auth_token')

    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.',
      statusCode: 401,
    })
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// ROUTE 4: POST /auth/logout
// The user clicks "Log out".
// We simply delete the auth cookie — the JWT is no longer sent with requests.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (_req: Request, res: Response) => {

  // clearCookie removes the cookie from the browser.
  // The name must exactly match what we used in res.cookie() above.
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  return res.json({ success: true, message: 'Logged out successfully' })
})


// Export the router so index.ts can register it
export default router