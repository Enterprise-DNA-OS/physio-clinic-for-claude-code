---
description: Record an outcome score against a treatment plan and say how far the patient has come from baseline to goal.
---

1. Resolve the plan from the patient name or ref: `node scripts/clinic.mjs plan "<name>" --json`.
2. Run `node scripts/clinic.mjs plan score PLAN-... --score=N [--note="..."] --json`.
3. Say the movement plainly: from baseline, to now, against the goal, as a percentage of the way.
4. If the target is met, suggest `plan close PLAN-... --achieved` and a discharge letter (`/draft-gp-letter`). If the plan has stalled, suggest a re-assessment.
