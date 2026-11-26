# Improve the harness

Run this at Deploy, after the review fixes and before the merge.

1. Compare this change's review findings, corrections and check failures with earlier evidence; identify mistakes that have happened at least twice.
2. For a repeated mistake, add an automated check if practical. Otherwise, update AGENTS.md or docs/REVIEW.md, or suggest a change to docs/STANDARDS.md. If the rule already exists, explain how to catch it in docs/REVIEW.md rather than duplicating it.
3. Remove guidance made obsolete by the changes.
4. Run the full check and record the result in docs/Status.md, including unit and end-to-end counts and expected skips.
5. Report gitleaks findings and other tool failures or warnings, with actionable details; never expose secrets.
6. As the last step, improve this checklist using what was learned.
