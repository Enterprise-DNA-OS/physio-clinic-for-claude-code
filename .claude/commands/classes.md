---
description: The class timetable - Clinical Pilates and rehab groups for the next two weeks, who is booked, what is full, where the spaces are, and how full classes ran last month.
---

1. Run `node scripts/clinic.mjs classes --json`, and `stats --json` for `class_fill_pct_28`.
2. Present the timetable as a table: date, time, class, instructor, booked of capacity, FULL where it is.
3. For a full class: name the next class with spaces and anyone on the waitlist who could take one. If classes keep filling, suggest a second class.
4. To book someone in: `node scripts/clinic.mjs class book CLS-... "<patient>" [--pass] [--case=CASE-...]`. To run the roll on the day: `class run CLS-... --dna=Name,Name` (pass holders use a class; everyone else is invoiced).
