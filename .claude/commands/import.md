---
description: Bring the clinic across from Nookal (or any system that exports CSV) - clients and appointments, dry-run first, idempotent, every skipped row named. Marketing consent is never assumed from the old system, and old clinical notes stay in the old export.
---

1. In Nookal: Manage, then Export under Data, choose Clients (CSV). Export an appointments report to CSV as well. Any system that exports those two shapes works.
2. Dry run first, always: `node scripts/clinic.mjs import nookal --patients=Clients.csv --appointments=Appointments.csv --dry-run`. Read out what would be created, matched, and skipped, with reasons.
3. Fix what it names (a practitioner not on the team: `practitioner add`, then re-run). Then run it without `--dry-run`. Run it twice and the second pass books nothing new.
4. Say the two honest things out loud: every imported patient arrives with the marketing question unanswered; and imported history carries no treatment notes here. The old notes live in the Nookal export, kept for the retention period (docs/replace-nookal.md).
5. Open cases, plans and passes are worth rebuilding by hand for active patients (`case add`, `plan add`, `pass add`), with their real funding and session counts; the importer deliberately does not guess at claims.
