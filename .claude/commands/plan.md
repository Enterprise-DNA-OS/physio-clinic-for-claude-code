---
description: Set up a treatment plan at the initial assessment - the goal in the patient's words, the outcome measure, baseline and target, how many sessions and how often.
---

1. Ask for: the case (or patient), the goal in the patient's words, the measure (PSFS, LEFS, Oswestry, NDI, QuickDASH, PRTEE, pain out of 10, or the clinic's own), the baseline score, the target, sessions planned and how often.
2. Run `node scripts/clinic.mjs plan add CASE-... --goal="..." --measure=... --baseline=N --target=N --sessions=N --every=7 [--lower-better] --json`. The baseline is recorded as the first score.
3. If the plan asks for more sessions than the funder approved, say so and name the paperwork (ACC32, a new care plan, a new DVA referral).
4. Offer to book the first few sessions at the agreed cadence with `book add`.
