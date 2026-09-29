<h1 align="center">Physio Clinic for Claude Code</h1>

<p align="center">
  <strong>The open-source physiotherapy and chiropractic clinic system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Nookal data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=nookal">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/nookal?utm_source=github&utm_medium=readme&utm_campaign=nookal">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-nookal">Instead of Nookal</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Physio Clinic for Claude Code does the job you pay Nookal for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Nookal dashboard cannot.

The bill this replaces is per practitioner, per month: Nookal lists Essentials at A$49 and Professional at A$59 per practitioner a month, with Enterprise quoted privately ([nookal.com/pricing](https://www.nookal.com/pricing)). A 10-practitioner clinic on Professional pays A$7,080 a year before GST, SMS from 7 cents a message, and the add-ons (a patient portal from $10 a location a month, secure messaging from $1.50 a user a month).

Want the same thing with a web front end, an online booking page, or claiming wired straight to ACC? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=nookal).

This one covers the operating record of a physiotherapy or chiropractic clinic, massage and Clinical Pilates included. The practitioners and their hours, the patient book, referrers, cases with their funding (ACC, Medicare care plan, DVA, insurer, private), the diary from booked to completed, SOAP treatment notes, **treatment plans** with a goal, an outcome measure (PSFS, LEFS, Oswestry, NDI, QuickDASH or your own) and the scores over time, **Clinical Pilates classes** with capacity and **class passes**, and **claims** to every funder from ready to lodged to paid or rejected. The rules of the trade are built in as gates with their sources cited: a funded case never books past its approval, a Medicare care plan stops at five visits a calendar year, a DVA referral stops at 12 sessions or a year, a claim never lodges without a finalised note, a DVA patient is never billed a gap, the ACC surcharge always sits on its own invoice, nothing completes without informed consent, and a finalised note is never edited. Payment processing and the funders' own claiming portals stay where they are, deliberately.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No per-practitioner fee, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/physio-clinic-for-claude-code.git
cd physio-clinic-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. The demo clinic, Bayfront Physio and Chiro in Tauranga, has five ACC claims worth $275 ready and never lodged, a sixth held back because its treatment note was never written, three of Rex's claims sitting with ACC for 50 days and a fourth rejected, Rex himself three sessions behind his shoulder plan with nothing booked, a back plan that has barely moved in three sessions, an ACC knee case at 15 of 16 approved sessions, a Pilates pass with six classes about to expire and another used up at tomorrow's full class, a case treated three times with no consent on record, and a GP practice that used to refer every month gone silent. The answer shows you exactly how this system thinks.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-practitioner fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first. An unwritten note outranks everything, because it blocks the claim too |
| `/claims` | Every claim to ACC, Medicare, DVA or an insurer: ready, blocked by a note, lodged and waiting, rejected |
| `/lodge` | Lodge the ready claims in one batch; anything without a final note is held back and named |
| `/claim-paid` | Record the remittance: paid, short paid, or rejected with the funder's reason |
| `/acc` | The ACC position: cases running down, ACC32s to lodge, ACC claims by state |
| `/plans` | Treatment plans against what happened: behind, nothing booked, stalled, re-score due |
| `/plan` | Set the plan at the initial: goal, measure, baseline, target, sessions, cadence |
| `/score` | Record an outcome score and see how far from baseline to goal |
| `/draft-progress-report` | The ACC32 or GP report, written from the plan's scores and the finalised notes |
| `/classes` | The Pilates timetable: booked of capacity, full classes, the roll on the day |
| `/passes` | Class passes: expiring with classes unused, used up, selling the next one |
| `/day` | The day sheet per practitioner: alerts, funding and confirmation state before it walks in |
| `/book` | The diary: the week, one day, one practitioner, every state loud |
| `/new-appointment` | Book a patient in; the gates speak and their refusals carry the fix |
| `/complete` | Close out a visit: invoiced to the right payer, the claim made ready, then the note |
| `/note` | The SOAP note: draft, finalise, and after that addenda only |
| `/notes-due` | Every clinical record not finalised, oldest first |
| `/dna` | Mark the no-show, count the habit, draft the follow-up |
| `/patient` | One patient's whole card before they are in the room |
| `/case` | Cases: funding, consent, the ACC32 extension, discharge |
| `/invoices` `/debtors` | What is billed, what is owing, patients and funders separately |
| `/takings` | Visits and dollars by practitioner |
| `/rebooking` | Who leaves holding their next appointment |
| `/gaps` | The empty diary, classes counted, next 7 days, and who fills it |
| `/dnas` | The 180-day record with each patient's habit counted |
| `/recalls` | Clinical follow-up due, consent line drawn |
| `/waitlist` | Who is waiting, matched against the open time |
| `/referrers` | Who sends patients, and who has gone quiet |
| `/team` `/services` | The practitioners, their hours, services with their funder codes and amounts |
| `/compliance` | The rule book run against the records, sources cited |
| `/weekly-review` | The Monday review written from five commands |
| `/log` | The conversation onto the patient's record |
| `/draft-reminders` `/draft-recall` `/draft-gp-letter` | Drafts to `drafts/`; a person sends them |
| `/import` | Bring the clinic across from Nookal, dry-run first |
| `/customise` | Change a field, a rule, a session count, in plain language |
| `/new-view` | A new read-only dashboard page, described in plain language |

`npm run view` renders the week, the clinical record (plans included) and the money (claims by state) as branded HTML pages. `npm run docs` renders invoices, statements, case summaries and a progress report per treatment plan.

## Instead of Nookal

Export your client list from Nookal (Manage, Export, Clients) and an appointments report as CSV, then:

```bash
node scripts/clinic.mjs import nookal --patients=Clients.csv --appointments=Appointments.csv --dry-run
node scripts/clinic.mjs import nookal --patients=Clients.csv --appointments=Appointments.csv
```

The importer matches common column-name variants, is idempotent (re-running books nothing twice), and names every row it skips. Two things are deliberate: every imported patient arrives with the marketing question unanswered, and old clinical notes stay in Nookal's own export as your retention copy rather than being re-typed. Claims already lodged through Nookal are reconciled there until they pay. [docs/replace-nookal.md](docs/replace-nookal.md) covers exactly what carries over, what starts fresh, and why.

### Ten questions your practice dashboard cannot answer

Each is one plain-language ask in Claude Code, and each is a command that runs today:

1. Which claims are ready to lodge, what are they worth, and which ones is a missing note holding back? (`claims --ready`)
2. What has each funder had longer than three weeks without paying, on whose cases? (`claims --status=lodged`, `attention`)
3. Which patients are behind the cadence their treatment plan agreed, with nothing booked? (`plans`)
4. Whose outcome score has barely moved after the sessions the plan allowed, before the approval runs out? (`plans`)
5. Which funded cases are fully committed inside visits already booked, and need the ACC32 or a new referral this week? (`cases`, `attention`)
6. Which class passes expire in the next fortnight with classes unused, and whose runs out at their next class? (`passes`, `attention`)
7. How full did Clinical Pilates run over the last four weeks, and which coming classes are already full? (`stats`, `classes`)
8. Which completed visits have no finalised note, in whose room, and what claim money each is holding up? (`notes-due`, `claims`)
9. Which regulars are past their usual visit rhythm with nothing booked, ranked by what they spent this year? (`lapsed`)
10. Which referrers used to send a patient a month and have gone quiet? (`referrers`)

## Your first hour: ten things to ask for

1. "Walk me through everything on the attention list and what clears each one."
2. "Lodge the ready claims and tell me what you held back."
3. "ACC paid CLM-3016 and CLM-3017 today. Record it."
4. "Who is dropping out of their treatment plan, and who do I call first?"
5. "Rex scored 33 on the QuickDASH today. Record it and tell me how far he has come."
6. "Set up a plan for Nathan: a week without a headache, NDI from 30 to 10 over six sessions."
7. "Is tomorrow's Pilates class full? Put Grace in the next one with a space."
8. "Draft the ACC32 progress report for Liam's knee from his scores and notes."
9. "Our ACC claims should be lodged the same day, not after three." (a one-line settings change)
10. "Import our clients and appointments from Nookal, dry run first."

## Architecture

```
physio-clinic-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/clinic.mjs        the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  views.json documents.json the dashboards and documents, as SQL
  docs/                     the thesis, the rule book and the migration guide
```

## Built with Claude Code

This repository was built with Claude Code as the primary development tool, from the schema to the commands, and it is meant to be extended the same way. Ask for a new command and it writes one.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Physio Clinic for Claude Code for your clinic, brings your Nookal data across, loads your fee schedule and funder codes, rebuilds your open cases, plans and passes, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=nookal)
- Read more: [enterprisedna.co/omni/instead-of/nookal](https://enterprisedna.co/omni/instead-of/nookal?utm_source=github&utm_medium=readme&utm_campaign=nookal)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
