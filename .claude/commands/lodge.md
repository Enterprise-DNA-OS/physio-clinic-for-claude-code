---
description: Lodge the day's or week's claims in one go - every ready claim with a finalised note is marked lodged, and anything held back is named with the fix.
---

1. Run `node scripts/clinic.mjs claims --ready --json` and show what would lodge: count, total, by funder, and which are blocked by a note.
2. Ask for a yes. Then run `node scripts/clinic.mjs claim lodge --ready --json`.
3. Report what lodged (refs and total) and what was refused, each with its fix. The refusal is the system working: a claim never goes without its note.
4. Remind the operator to submit the same batch through the funder's portal or HICAPS if they have not already, so the record matches reality.
