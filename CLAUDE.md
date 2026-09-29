# Physio Clinic for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Clinic:** [YOUR CLINIC]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a patient, read their full card first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a patient waits for a yes in this session.
6. **The note is part of the visit.** A completed appointment without a finalised treatment note is unfinished work, and its claim cannot lodge; say so whenever you see one.
7. **The plan is the promise.** Every funded case should carry a treatment plan with a goal, a measure and a baseline. A plan with nothing booked is a patient leaving; raise it.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| "what needs my attention", "what's wrong this morning" | `/attention` |
| "the day sheet", "who is in today / tomorrow" | `/day` |
| "show me the diary", "how's next week looking" | `/book` |
| "book X in", "can Kate fit a follow-up Thursday" | `/new-appointment` |
| "X is done", "close out the 9 o'clock", "invoice it" | `/complete` |
| "take the note", "finalise my notes", "add an addendum" | `/note` |
| "what notes are owing" | `/notes-due` |
| "X didn't show" | `/dna` |
| "pull up X", "what do we know about X" | `/patient` |
| "open a case", "record consent", "the ACC32 came back", "discharge" | `/case` |
| "where are we with ACC", "which claims need an ACC32" | `/acc` |
| "claims", "what's ready to claim", "what has ACC / Medicare / DVA not paid" | `/claims` |
| "lodge today's claims", "do the claiming" | `/lodge` |
| "the remittance came in", "ACC paid", "that claim was rejected" | `/claim-paid` |
| "how are the treatment plans going", "who's dropping out" | `/plans` |
| "set up a plan", "baseline is PSFS 3, goal 8" | `/plan` |
| "Oswestry is 30 today", "record the score" | `/score` |
| "progress report", "ACC32 report", "report to the GP on the care plan" | `/draft-progress-report` |
| "the Pilates timetable", "is Thursday's class full", "book X into class" | `/classes` |
| "class passes", "who needs a new pass", "sell a 10-class pass" | `/passes` |
| "what's owing", "invoices", "record a payment" | `/invoices` |
| "who owes us", "aged debtors", "what does ACC owe" | `/debtors` |
| "what did we take", "how's the week" | `/takings` |
| "how's rebooking" | `/rebooking` |
| "how quiet is next week", "where are the gaps" | `/gaps` |
| "who keeps not showing" | `/dnas` |
| "who's due for recall", "recalls" | `/recalls` |
| "who's waiting", "fill tomorrow from the waitlist" | `/waitlist` |
| "who refers to us", "who's gone quiet" | `/referrers` |
| "the team", "change Kate's hours", "add a service" | `/team` |
| "are we compliant", "check the rules" | `/compliance` |
| "Monday review", "how are we set for the week" | `/weekly-review` |
| "note that X rang...", "log the call" | `/log` |
| "remind tomorrow's patients", "chase the overdue invoices" | `/draft-reminders` |
| "win back the quiet ones", "recall messages" | `/draft-recall` |
| "letter to the GP", "progress letter", "discharge letter" | `/draft-gp-letter` |
| "bring our Nookal data across" | `/import` |
| "add a field", "change a rule", "notes are due same-day here" | `/customise` |
| "a page that shows..." | `/new-view` |

If an ask fits nothing here, run the CLI directly (`node scripts/clinic.mjs help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Patients archive, cases discharge, appointments cancel with a reason.
- A finalised treatment note never changes. Corrections are addenda. Do not look for a way around this; there is none.
- Never invent clinical content. Notes carry the practitioner's words; if a field was not said, it stays empty.
- Never lodge a claim whose note is not final, and never bill a DVA patient a gap. The CLI refuses both; do not look for a way around it.
- Lodging here records that a claim went through the funder's own channel (ACC online, Medicare, DVA, HICAPS). Nothing here connects to a funder.
- Outcome scores are what the patient scored. Never estimate one.
- Marketing drafts only ever address patients who opted in. "Never asked" means a phone call, not a message.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis, the rule book (`compliance.md`) and the guide for moving off Nookal.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/nookal
