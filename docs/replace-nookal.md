# Moving off Nookal

The whole move is: export your client list and your appointments from Nookal, run one command twice (dry run, then real), rebuild the open cases, plans and class passes for active patients, and keep the old export for the retention period. A quiet afternoon for a typical clinic.

## 1. Export from Nookal

- **Clients** (CSV): in Nookal, **Manage**, then **Export** under Data, choose **Clients** and the location(s). The file queues, then downloads as CSV. Nookal documents this in its help article "Exporting a List of Client Details".
- **Appointments** (CSV): any Nookal appointment report you can export to CSV that lists the date, time, client, provider and appointment type. The importer matches the columns loosely.
- **Everything else** (clinical notes, letters, invoices, ACC claim history): download what Nookal offers and keep it. See "what stays behind" below: this archive is your retention copy.

## 2. Import

```bash
node scripts/clinic.mjs import nookal --patients=Clients.csv --appointments=Appointments.csv --dry-run
node scripts/clinic.mjs import nookal --patients=Clients.csv --appointments=Appointments.csv
```

The dry run writes nothing and names everything: who would be created, who matched an existing record, and every skipped row with its reason (a missing date, a practitioner not on the team). Fix what it names (`practitioner add`, then re-run). The real run is idempotent: run it five times, the book is the same.

Column names are matched loosely: `First Name`/`Last Name` or a single `Client`/`Name`; `Mobile` or `Phone`; `Date` plus `Time` or a single `Starts at`; `Provider` or `Practitioner`; `Appointment Type`, `Service` or `Item`. DD/MM/YYYY dates are handled. Appointment types not on your service list are created as they arrive, with the row's duration and price. If your export's columns are named differently, ask Claude Code to map them: it reads the header row and adjusts the import in a minute.

## What carries over

- **Clients**: name, date of birth, phone, email, referral source. Matching is by name: an existing patient is updated (empty fields filled), never duplicated.
- **Appointment history**: imported as completed visits, so rhythms, lapsed detection and the patient card's history work from day one.
- **The booked future**: rows dated today or later arrive as bookings.
- **Services**: created from the appointment types in the export. Add your ACC codes, MBS or DVA item numbers and the funder's amount to each one after: `service add` for new ones, or ask Claude Code to set them from your fee schedule.

## What starts fresh, deliberately

- **Marketing consent.** Every imported patient arrives with the marketing question unanswered. A tickbox nobody remembers from the old system is not consent (Unsolicited Electronic Messages Act 2007; Spam Act 2003). The desk asks at the next visit: `patient set NAME --opt-in=yes|no`.
- **Cases and funding.** The importer does not guess at ACC claims, care plans or DVA referrals. For each active patient, open the real case with the real numbers: `case add PATIENT --title="..." --funding=acc --claim=AB12345 --sessions=16`. For a care plan or DVA referral, name the GP: `--referrer="Dr ..."`.
- **Claims in flight.** Claims already lodged through Nookal stay in Nookal until ACC, Medicare or DVA pays them; reconcile those remittances there. New visits create their claims here from day one.
- **Treatment plans.** Set the plan and baseline for each active case at the next visit: `plan add CASE-1 --goal="..." --measure=PSFS --baseline=3 --target=8 --sessions=8`.
- **Class passes.** Re-issue each active pass with the classes left and its expiry: `pass add PATIENT --classes=6 --price=0 --expires=DATE` records a carried-over pass without charging again (use the smallest price your till accepts if it insists on one).
- **Informed consent.** Recorded per case, at the next visit (`case consent CASE-1`). The complete gate will insist anyway.

## What stays behind, honestly

- **Old clinical notes.** A clinical note re-typed into a new system is a transcription risk with no clinical value. They stay in the export you downloaded, which you keep for the retention period (10 years NZ; 7 years or age 25 AU). Imported visits are marked so this system never asks for notes it was never owed.
- **Letters, attachments and outcome measure history.** Same story: they live in the archive folder.
- **Online bookings, SMS, the patient portal and direct claiming.** The free version drafts reminders and records claims; a person sends and lodges them through the funder's own channel. A booking page, wired-up SMS and claiming straight from the system are what Enterprise DNA builds into a customised version.

## The first week after

1. `/attention` every morning: it will surface what the import could not know (cases to open, plans to set, recalls to add).
2. `/claims` at the end of each day: lodge what is ready.
3. Add the referrers you live on: `referrer add`, and point cases at them.
4. `npm test` any time you want proof the machine still holds.

Rather have all of this done for you, including the case rebuild and the claim reconciliation? That is the installed version: https://enterprisedna.co/omni/instead-of/nookal
