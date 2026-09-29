# The rules this clinic lives under

`/compliance` (the CLI's `compliance` command) checks the records against these rules. Each rule names its source. Nothing here is legal advice: this doc records the rules the operator has told the system to enforce, and the check reports what the data says.

The demo clinic is a New Zealand physiotherapy and chiropractic practice, so the NZ instruments lead. The Australian rules sit beside them because Nookal's home market is Australia and the schema carries both: the `epc` funding type is the Medicare chronic disease management care plan, and `dva` is a Department of Veterans' Affairs referral.

## records: treatment notes finalised promptly

Every completed visit gets a treatment note, and the note is finalised within the window in settings (`note_due_days`, default 2 days). Once final, a note is never edited: corrections are dated addenda.

- Physiotherapy Board of New Zealand, *Physiotherapy standards*: record keeping (records made at the time of care or as soon as practicable after).
- Ahpra National Boards, *Codes of conduct*, health records section (clear, accurate, contemporaneous records).
- What a breach looks like in the data: a row in `v_notes_due` older than `note_due_days`.

## consent: informed consent per episode of care

Every case with treatment on it carries a consent date. The `complete` command refuses a visit on a case with no consent recorded; there is no force flag.

- Code of Health and Disability Services Consumers' Rights 1996 (NZ), Right 7: services only with informed consent.
- Ahpra National Boards, *Codes of conduct*, informed consent sections (AU).
- Breach: an open case with `sessions_used > 0` and `consent_recorded_on` null.

## funded-sessions: funded care stays inside its approval

An ACC claim treats up to its approved sessions; continuing needs an ACC32 (request for prior approval of further treatment) and the outcome recorded with `case extend`. A Medicare chronic disease management (care plan / EPC) referral holds at most five allied health services per patient per calendar year across MBS items 10950 to 10970. The booking gate enforces both; the check reports any case already committed past its approval.

- ACC treatment provider requirements: prior approval for treatment beyond the initial allocation (ACC32).
- Medicare Benefits Schedule, chronic disease management allied health items 10950 to 10970: five services per calendar year.
- DVA: a referral from the veteran's GP covers one treatment cycle, up to 12 sessions or 12 months, whichever comes first. `case add --funding=dva` sets 12 sessions and the expiry a year from the referral date, and the gate refuses anything past either.
- Breach: an open funded case with `sessions_used + sessions_booked > approved_sessions`. A class attended on a funded case counts as a session.

## retention: the clinical record survives discharge and archive

Nothing deletes here. Patients archive, cases discharge, appointments cancel with a reason, and the notes stay.

- Health (Retention of Health Information) Regulations 1996 (NZ): health information kept at least 10 years from the last care event.
- State health records Acts (AU, e.g. Health Records Act 2001 (Vic)): 7 years from last entry for adults, or until age 25 for children.
- Breach: a discharged case with completed (non-imported) visits and no notes.

## marketing-consent: marketing only ever addresses patients who opted in

`marketing_opt_in` is three-state: yes, no, never asked. Recall and win-back drafts only ever address the opted-in; everyone else lands on a call list. Reminders about a booked appointment are not marketing and go to anyone with a booking.

- Unsolicited Electronic Messages Act 2007 (NZ); Spam Act 2003 (Cth): consent before commercial electronic messages.
- Privacy Act 2020 (NZ) / Privacy Act 1988 (Cth): health information used for the purpose it was collected.
- The check reports how many active patients have never been asked, so the desk asks.

## cancellations: every cancellation and DNA keeps its record and reason

The `cancel` command requires a reason; `dna` marks, never erases. The appointment record is part of the health record.

- Professional record-keeping standards, as above: the appointment history is evidence of the care pathway.
- Breach: a cancelled appointment with no reason on it.

## claims-evidence: every claim rests on a finalised note

`claim lodge` refuses a claim whose visit has no finalised treatment note, one at a time or in a batch (`claim lodge --ready` lodges what it can and names what it held back). Funders audit claims against the clinical record; a claim with no note behind it is a claim that can be recovered.

- ACC: treatment providers keep clinical records that support what they invoice ACC for (Accident Compensation Act 2001 and the provider's ACC contract or schedule).
- Medicare: services claimed must be supported by adequate and contemporaneous records (Health Insurance Act 1973 (Cth); Services Australia Medicare compliance guidance).
- Breach: a lodged or paid claim whose visit note is missing or in draft.

## funder-billing: no gap to a DVA patient, and the ACC surcharge stands alone

`complete` bills a funded visit by its funding. A DVA visit bills DVA the fee on the service and nothing to the veteran. An ACC visit bills ACC its contribution and, when the clinic charges more, puts the difference on a separate patient invoice labelled as a surcharge, so the ACC claim only ever carries ACC's part. A Medicare care plan visit is either bulk billed (setting `medicare_bulk_bill` = yes, no gap) or billed to the patient with the rebate claim lodged for them.

- DVA, *Notes for Allied Health Providers*: providers accept the DVA fee as full payment and do not charge the entitled person.
- ACC: any fee above the ACC contribution is charged to the patient separately from the ACC invoice.
- Breach: a patient invoice on a DVA case, or an ACC invoice carrying a surcharge line.

## referrals: the care plan cap and referral expiry

The booking gate counts a patient's care plan visits in the calendar year of the booking and refuses the sixth (setting `cdm_year_cap`, default 5). It only sees this clinic's visits: other allied health providers may have used some of the five, so the desk still asks. Any case with `referral_expires_on` books nothing after that date.

- Medicare Benefits Schedule, items 10950 to 10970: up to five allied health services per patient per calendar year.
- DVA treatment cycle: 12 sessions or 12 months from the referral.
- Breach: a patient with more than the cap in one calendar year, or a visit dated after its referral's expiry.

## Changing a rule

Rules move (session counts, retention periods, board standards). When one does: the operator confirms the new rule and its source, then the doc and the check in `scripts/clinic.mjs` change together, in the same commit. `/customise` handles the plain-language ask.
