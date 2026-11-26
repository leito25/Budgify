# Review policy

Every change is reviewed against this policy before it merges. The reviewer reports its findings and doesn't change any code.

## Passes

Make a separate pass over every change for each of these:

- **Bugs:** the code does what it's meant to, including when something goes wrong.
- **Security:** no secrets or personal data are exposed, and nobody can do what they shouldn't.
- **Matches spec.md and the current change plan:** the change does what those documents say, with nothing missing and nothing extra.
- **Spec drift:** Flag code or behavior that `spec.md` does not describe.
- **Coding standards:** Check code changes against `docs/STANDARDS.md`.

## Important

An Important finding must be fixed before the change merges. A finding is Important if the change breaks behavior that should work, leaks data or breaks a rule in AGENTS.md.

## Async state

- Verify actions wait for fresh repository results and never act on cached or pending state.
- Verify concurrent writes are ordered, failed writes stop the affected action, and later writes use the saved state.
- For delayed responses and queued writes, verify the result stays bound to its original request or action, while state-dependent decisions use the latest saved state.
- Test an intervening state change while a request or write is pending, and verify the resulting persisted data.
- Verify sign-in, theme changes, resets, CRUD, and other saves have regression coverage for immediate follow-up actions.

## Nits

A nit is a small point, such as style or naming, that doesn't block the merge. Report at most five per review.
