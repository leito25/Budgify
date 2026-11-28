Findings:

Important: A delayed 401 can sign out the newly signed-in session. client.ts always calls onSignedOut() without verifying that the 401 belongs to the request’s original token.
Important: Search results are not discarded when the workspace or session changes. SearchBox.tsx only tracks newer text, so an earlier Small Business search can appear after switching to Personal.
