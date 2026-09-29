---
description: Class passes - who has classes left, whose pass expires soon with classes unused, whose pass runs out at their next class, and selling the next one.
---

1. Run `node scripts/clinic.mjs passes --json`.
2. Present: passes expiring in the next two weeks with classes unused (book them in, or extend as goodwill), passes used up at the next class (offer the next pass in the room), expired passes with classes left (a goodwill decision for the owner).
3. To sell a pass: `node scripts/clinic.mjs pass add "<patient>" --classes=10 --price=300 [--expires=DATE]`. It invoices the patient.
4. Messages about passes are marketing: draft only for patients who opted in, and everyone else is a conversation at the desk.
