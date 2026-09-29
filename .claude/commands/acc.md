---
description: The ACC position in one look - every ACC case with sessions used, booked and remaining, which need an ACC32 now, and every ACC claim that is ready, blocked, lodged and unpaid, or rejected.
---

1. Run `node scripts/clinic.mjs cases --json` and keep the `funding = "acc"` rows; then `claims --funder=acc --json`.
2. Present three short tables: cases running down (remaining <= 2, worst first, with the patient and claim number), claims not yet paid grouped by status (ready, blocked by a note, lodged with days waiting, rejected with ACC's reason), and the total ACC money in each state.
3. For every case at or near its limit: the action is the ACC32 now, then `case extend CASE-1 --sessions=N` when the outcome lands. Say which patients have sessions booked that depend on it.
4. For ready claims: offer `claim lodge --ready`, and say which ones it will hold back and why. For lodged claims past 21 days: check the remittance and name the claim refs to query.
