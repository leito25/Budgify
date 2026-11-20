---
name: commit-and-push
description: Update the project status, commit completed changes, and push them to the Budgify GitHub repository whenever changes need to be committed.
---

# Commit and push

1. Review the changes and update `docs/Status.md` to reflect the completed work. Run the relevant checks for the changes.
2. Check the Git status, current branch, configured author, and `origin` remote. Confirm the remote points to `leito25/Budgify` and that the author uses `leito25@gmail.com`. If the identity, remote, branch, or authentication is unclear, stop and ask rather than guessing. Never expose credentials.
3. Stage only the changes belonging to the work, including the status update. Preserve unrelated or pre-existing changes; use selective staging if a file contains both. Review the staged diff and check it for secrets before committing.
4. Commit with a descriptive message and include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` as a trailer.
5. Push the commit to the current branch's GitHub upstream. If there is no upstream, confirm the intended branch before setting one. Do not force-push or overwrite remote changes.
6. Verify that the push succeeded and report the outcome. If authentication, commit, or push fails, report the error and leave the changes intact.
