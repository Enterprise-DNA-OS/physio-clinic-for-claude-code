---
description: The Monday review, written from five commands - what needs a decision, the week's diary and classes, the money (takings, claims by state, debtors), and the clinical risks (notes owing, plans off track, funded cases running down, consent gaps, lapsed patients).
---

1. Run five commands, `--json` each: `node scripts/clinic.mjs attention`, `book`, `claims`, `plans`, `takings --days=7`. Add `classes`, `debtors`, `rebooking`, `lapsed` and `gaps` when the week looks quiet.
2. Write the review in four short sections, prose plus small tables, nothing invented:
   - **Today's decisions.** The attention list, worst first, one action each. An unwritten treatment note or a funded case at its limit is the first line of the whole review.
   - **The week's diary.** Day by day: how full each practitioner is, what is unconfirmed, where the gaps are and who on the waitlist fits them, and which classes are full.
   - **The money.** Last week's takings by practitioner, claims ready to lodge and blocked by a note, what each funder has had longer than three weeks, rejections, and patients owing.
   - **The clinical record.** Notes not finalised (by practitioner), plans with nothing booked or stalled, cases needing an ACC32 or a new referral this week, consent gaps, and the lapsed regulars worth a call.
3. End with at most five actions for the week, each doable with a single command or phone call.
4. On paper: `npm run view` renders the week, clinical and money pages in the clinic's brand.
