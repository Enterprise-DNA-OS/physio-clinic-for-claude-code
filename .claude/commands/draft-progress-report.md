---
description: Draft a progress report for a funded case - to ACC with an ACC32, or to the referring GP under a care plan or DVA referral - built from the treatment plan's outcome scores and the finalised notes.
---

1. Resolve the case: `node scripts/clinic.mjs case CASE-... --json`, the plan (`plan "<patient>" --json`) and the notes (`notes "<patient>" --json`, finalised ones only).
2. Write the report in the clinic's voice: diagnosis, sessions used of approved, outcome measure from baseline to latest against the goal, what changed, what is planned, and (for an ACC32) how many more sessions and why.
3. Numbers come only from the records. If the plan has no recent score, say so and ask for one before drafting.
4. Save to `drafts/progress-<case ref>-<date>.md`. Never send it: the practitioner reads, signs and submits it through the funder's channel.
