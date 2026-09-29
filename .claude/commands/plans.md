---
description: Treatment plans against what actually happened - who is behind their agreed cadence, who has nothing booked, whose outcome score has stalled, and who is due a re-score.
---

1. Run `node scripts/clinic.mjs plans --json`.
2. Present the plans that need something first: DROPPING OUT (behind with nothing booked), NOTHING BOOKED, STALLED, RE-SCORE DUE, then the ones on track in one line each.
3. For each one that needs something, one action: a call and a booking for a dropout; a re-assessment conversation for a stalled plan; `plan score PLAN-... --score=N` at the next visit for a re-score.
4. For a patient the operator names, run `plan PLAN-...` (or `plan "<name>"`) and show the score history as a small table from baseline to now against the goal.
