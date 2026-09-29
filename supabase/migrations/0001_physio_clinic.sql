-- physio-clinic-for-claude-code: core schema.
-- A physiotherapy or chiropractic clinic's operating record the way Nookal
-- sells it: the practitioners and their hours, the patient book, referrers,
-- cases with their funding (ACC, Medicare care plan, DVA, insurer, private),
-- the diary, treatment notes, treatment plans with outcome scores, group
-- classes and class passes, claims to every funder from ready to paid,
-- invoices and payments, recalls and the waitlist.
--
-- Runs unchanged on PGlite (embedded) and on Postgres / Supabase.
-- Money is in cents, NZD by default. GST and payroll stay in accounting and
-- payroll, deliberately.
--
-- Deliberately NOT here: payments processing, online booking pages, SMS
-- sending, claiming APIs. Reminders and recalls draft to drafts/ and a person
-- sends them; claims go through the channel the funder requires.
--
-- The sharp edges are deliberate:
--   * a treatment note is written for every completed appointment, and once
--     finalised it is never edited: corrections are addenda (Physiotherapy
--     Board of New Zealand, Physiotherapy standards: record keeping; AHPRA
--     codes of conduct, health records)
--   * a funded episode of care never books past its approved sessions: an
--     ACC case stops at the approved count until an ACC32 outcome is
--     recorded, a Medicare care plan stops at the sessions the plan holds
--     and at five allied health visits in a calendar year, a DVA referral
--     stops at 12 sessions or its expiry date, whichever comes first
--   * a claim is never lodged for a visit whose treatment note is not
--     finalised: the note is what the funder audits
--   * a DVA visit never carries a gap to the veteran, and an ACC surcharge
--     is always its own line on the patient's invoice, never folded into
--     the ACC claim
--   * a class never books past its capacity
--   * completing a visit on a case with no informed consent on record is
--     refused (Code of Health and Disability Services Consumers' Rights
--     1996, Right 7)
--   * nobody is double-booked, and nothing is booked outside a
--     practitioner's recorded working hours
--   * recall and marketing drafts only ever address patients who opted in
--     (Unsolicited Electronic Messages Act 2007; Spam Act 2003 (Cth));
--     reminders about a booked appointment are not marketing
--   * no deleting records: appointments cancel with a reason, patients
--     archive, cases discharge, the clinical record stays

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- Settings ------------------------------------------------------------------------
-- The handful of numbers the rules and views read. Change them with
-- `settings set`.

create table if not exists settings (
  key         text primary key,
  value       text not null,
  note        text,
  updated_at  timestamptz not null default now()
);

insert into settings (key, value, note) values
  ('clinic_name',          'Your Clinic', 'shown on documents'),
  ('currency',             'NZD',  'money formatting'),
  ('note_due_days',        '2',    'a completed visit needs its note finalised within this many days'),
  ('invoice_due_days',     '14',   'days from issue to due'),
  ('funded_warn_remaining','2',    'warn when a funded case has this many sessions or fewer left'),
  ('reminder_days',        '1',    'draft reminders for bookings this many days out'),
  ('recall_horizon_days',  '7',    'recalls due within this many days are raised'),
  ('claim_ready_days',     '3',    'a claim ready this many days without lodging is raised'),
  ('claim_unpaid_days',    '21',   'a lodged claim unpaid this many days is raised'),
  ('plan_behind_sessions', '2',    'a treatment plan this many sessions behind its cadence is raised'),
  ('pass_expiry_days',     '14',   'unused classes on a pass expiring within this many days are raised'),
  ('pass_valid_days',      '120',  'a new class pass is valid this many days unless --expires says otherwise'),
  ('cdm_year_cap',         '5',    'Medicare care plan allied health visits allowed per patient per calendar year'),
  ('medicare_bulk_bill',   'no',   'yes: care plan visits are bulk billed, no gap; no: the patient pays and the rebate is claimed for them')
on conflict (key) do nothing;

-- Practitioners ---------------------------------------------------------------------
-- The clinical team. Working hours live in practitioner_hours; the booking
-- gate reads them.

create table if not exists practitioners (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  discipline       text not null default 'physiotherapist',
  registration_no  text,
  status           text not null default 'active' check (status in ('active', 'former')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_practitioners_updated on practitioners;
create trigger trg_practitioners_updated before update on practitioners
  for each row execute function set_updated_at();

create table if not exists practitioner_hours (
  practitioner_id  uuid not null references practitioners(id),
  weekday          int  not null check (weekday between 0 and 6),  -- 0 = Sunday
  starts_at        time not null,
  ends_at          time not null,
  primary key (practitioner_id, weekday)
);

-- Referrers -------------------------------------------------------------------------
-- The GPs, specialists and practices that send patients. A physio or chiro
-- clinic lives on these relationships; the view says who has gone quiet.

create table if not exists referrers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  practice    text,
  kind        text not null default 'gp' check (kind in ('gp', 'specialist', 'insurer', 'other')),
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

-- Patients --------------------------------------------------------------------------
-- marketing_opt_in three-state: true opted in, false opted out, null never
-- asked. Recall and marketing drafts read it; appointment reminders do not.

create table if not exists patients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  date_of_birth     date,
  phone             text,
  email             text,
  nhi               text,           -- NZ National Health Index, if known
  address           text,
  referral_source   text,
  marketing_opt_in  boolean,
  alerts            text,           -- medical alerts: allergies, red flags, falls risk
  status            text not null default 'active' check (status in ('active', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_patients_updated on patients;
create trigger trg_patients_updated before update on patients
  for each row execute function set_updated_at();

-- Cases ----------------------------------------------------------------------------
-- An episode of care: one condition, one funding arrangement. ACC cases carry
-- the claim number and approved sessions; Medicare care plans (EPC / CDM)
-- carry the sessions the plan holds; private cases carry neither.

create table if not exists cases (
  id                   uuid primary key default gen_random_uuid(),
  ref                  text not null unique,       -- CASE-101
  patient_id           uuid not null references patients(id),
  title                text not null,              -- "Right knee ACL rehab"
  funding              text not null default 'private'
                       check (funding in ('acc', 'epc', 'dva', 'insurer', 'private')),
  claim_number         text,                       -- ACC45 claim number, plan reference
  injury_date          date,
  approved_sessions    int,                        -- null = uncapped (private)
  referrer_id          uuid references referrers(id),
  referral_date        date,
  referral_expires_on  date,                       -- DVA: one year from referral
  consent_recorded_on  date,                       -- informed consent, Right 7
  status               text not null default 'open' check (status in ('open', 'discharged')),
  opened_on            date not null default current_date,
  discharged_on        date,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
drop trigger if exists trg_cases_updated on cases;
create trigger trg_cases_updated before update on cases
  for each row execute function set_updated_at();

-- Services --------------------------------------------------------------------------

create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  discipline   text,
  kind         text not null default 'followup' check (kind in ('initial', 'followup', 'other')),
  minutes      int not null default 30,
  price_cents  int not null default 0,
  item_code    text,               -- the funder's code: ACC schedule, MBS item, DVA item
  funder_cents int,                -- what the funder pays for it; the rest is the patient's
  is_class     boolean not null default false,
  capacity     int,                -- default class size
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Appointments ----------------------------------------------------------------------

create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,            -- APT-1001
  patient_id       uuid not null references patients(id),
  practitioner_id  uuid not null references practitioners(id),
  case_id          uuid references cases(id),
  service_id       uuid not null references services(id),
  on_date          date not null,
  starts_at        time not null,
  ends_at          time not null,
  status           text not null default 'booked'
                   check (status in ('booked', 'confirmed', 'completed', 'dna', 'cancelled')),
  cancel_reason    text,
  imported         boolean not null default false,  -- history from the old system; its notes live in that system's export
  price_cents      int not null default 0,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_appointments_updated on appointments;
create trigger trg_appointments_updated before update on appointments
  for each row execute function set_updated_at();

-- Treatment notes --------------------------------------------------------------------
-- One per completed appointment, SOAP shape. Draft until finalised; after
-- that the record is immutable and corrections are addenda.

create table if not exists treatment_notes (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null unique references appointments(id),
  patient_id       uuid not null references patients(id),
  practitioner_id  uuid not null references practitioners(id),
  case_id          uuid references cases(id),
  on_date          date not null,
  subjective       text,
  objective        text,
  assessment       text,
  plan             text,
  addendum         text,
  status           text not null default 'draft' check (status in ('draft', 'final')),
  finalised_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_treatment_notes_updated on treatment_notes;
create trigger trg_treatment_notes_updated before update on treatment_notes
  for each row execute function set_updated_at();

-- Conversation log --------------------------------------------------------------------
-- Phone calls, front desk conversations, admin notes. Not the clinical record.

create table if not exists patient_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  on_date     date not null default current_date,
  author      text,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Invoices and payments ----------------------------------------------------------------
-- payer says who owes it: the patient at the desk, ACC on the schedule, or an
-- insurer. The card terminal keeps taking the money; this is the record.

create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,                 -- INV-2001
  patient_id  uuid not null references patients(id),
  case_id     uuid references cases(id),
  payer       text not null default 'patient' check (payer in ('patient', 'acc', 'medicare', 'dva', 'insurer')),
  issued_on   date not null default current_date,
  due_on      date not null,
  status      text not null default 'sent' check (status in ('draft', 'sent', 'paid', 'written_off')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_invoices_updated on invoices;
create trigger trg_invoices_updated before update on invoices
  for each row execute function set_updated_at();

create table if not exists invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references invoices(id),
  description  text not null,
  qty          int not null default 1,
  unit_cents   int not null default 0
);

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id),
  on_date     date not null default current_date,
  amount_cents int not null check (amount_cents > 0),
  method      text not null default 'card' check (method in ('card', 'cash', 'transfer', 'acc', 'medicare', 'dva', 'insurer', 'pass', 'other')),
  created_at  timestamptz not null default now()
);

-- Recalls and the waitlist ----------------------------------------------------------------

create table if not exists recalls (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id),
  due_on      date not null,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_recalls_updated on recalls;
create trigger trg_recalls_updated before update on recalls
  for each row execute function set_updated_at();

create table if not exists waitlist (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(id),
  service_id       uuid references services(id),
  practitioner_id  uuid references practitioners(id),   -- null = anyone
  added_on         date not null default current_date,
  note             text,
  status           text not null default 'waiting' check (status in ('waiting', 'booked', 'removed')),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_waitlist_updated on waitlist;
create trigger trg_waitlist_updated before update on waitlist
  for each row execute function set_updated_at();

-- Claims -------------------------------------------------------------------------------
-- One per funded visit (or class attendance): what goes to ACC, Medicare,
-- DVA or an insurer, from ready to lodge to paid. The invoice to the funder
-- carries the money; the claim carries the lodgement.

create table if not exists claims (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique,            -- CLM-3001
  funder          text not null check (funder in ('acc', 'medicare', 'dva', 'insurer')),
  patient_id      uuid not null references patients(id),
  case_id         uuid references cases(id),
  appointment_id  uuid unique references appointments(id),
  class_id        uuid,                            -- set for a class attendance
  invoice_id      uuid references invoices(id),
  service_on      date not null,
  item_code       text,
  amount_cents    int not null default 0,
  status          text not null default 'ready'
                  check (status in ('ready', 'lodged', 'paid', 'rejected', 'written_off')),
  lodged_on       date,
  paid_on         date,
  reject_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_claims_updated on claims;
create trigger trg_claims_updated before update on claims
  for each row execute function set_updated_at();

-- Treatment plans and outcome scores ------------------------------------------------------
-- The plan agreed at the initial: the goal, the measure that proves it
-- (PSFS, Oswestry, NDI, LEFS, QuickDASH, pain out of 10), the baseline and the
-- target, how many sessions and how often. Scores land against it over time.

create table if not exists treatment_plans (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null unique,          -- PLAN-401
  case_id           uuid not null references cases(id),
  patient_id        uuid not null references patients(id),
  practitioner_id   uuid references practitioners(id),
  goal              text not null,
  measure           text not null,                 -- 'PSFS', 'Oswestry %', 'pain /10'
  higher_is_better  boolean not null default true,
  baseline          numeric not null,
  target            numeric not null,
  planned_sessions  int not null,
  every_days        int not null default 7,        -- the agreed cadence
  review_every      int not null default 4,        -- re-score every N sessions
  starts_on         date not null default current_date,
  status            text not null default 'active' check (status in ('active', 'achieved', 'stopped')),
  closed_on         date,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
drop trigger if exists trg_treatment_plans_updated on treatment_plans;
create trigger trg_treatment_plans_updated before update on treatment_plans
  for each row execute function set_updated_at();

create table if not exists outcome_scores (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references treatment_plans(id),
  on_date         date not null default current_date,
  score           numeric not null,
  appointment_id  uuid references appointments(id),
  note            text,
  created_at      timestamptz not null default now()
);

-- Classes and passes ----------------------------------------------------------------------
-- Clinical Pilates, rehab groups, hydro: one class, many attendees, a
-- capacity. A pass is a prepaid block of classes.

create table if not exists class_passes (
  id            uuid primary key default gen_random_uuid(),
  ref           text not null unique,              -- PASS-601
  patient_id    uuid not null references patients(id),
  name          text not null,                     -- '10-class Pilates pass'
  classes_total int not null check (classes_total > 0),
  price_cents   int not null default 0,
  bought_on     date not null default current_date,
  expires_on    date,
  created_at    timestamptz not null default now()
);

create table if not exists classes (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,           -- CLS-501
  service_id       uuid not null references services(id),
  practitioner_id  uuid not null references practitioners(id),
  on_date          date not null,
  starts_at        time not null,
  ends_at          time not null,
  capacity         int not null check (capacity > 0),
  status           text not null default 'scheduled' check (status in ('scheduled', 'run', 'cancelled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_classes_updated on classes;
create trigger trg_classes_updated before update on classes
  for each row execute function set_updated_at();

create table if not exists class_attendees (
  class_id    uuid not null references classes(id),
  patient_id  uuid not null references patients(id),
  case_id     uuid references cases(id),
  pass_id     uuid references class_passes(id),
  status      text not null default 'booked' check (status in ('booked', 'attended', 'dna', 'cancelled')),
  created_at  timestamptz not null default now(),
  primary key (class_id, patient_id)
);

-- Views ===============================================================================
-- The reads the weekly commands live on.

-- Patients with their rhythm: last visit, spend, the usual gap between
-- visits (needs 3+ completed visits to mean anything), and the lapsed flag.
create or replace view v_patients as
with visits as (
  select patient_id, on_date,
         lag(on_date) over (partition by patient_id order by on_date) as prev_date
  from appointments
  where status = 'completed'
),
rhythm as (
  select patient_id,
         count(*) + 1 as visit_count,   -- gaps + 1
         avg(on_date - prev_date) as usual_gap_days
  from visits
  where prev_date is not null
  group by patient_id
  having count(*) >= 2                  -- a rhythm needs three visits to mean anything
),
last_visit as (
  select patient_id, max(on_date) as last_visit_on
  from appointments where status = 'completed' group by patient_id
),
next_appt as (
  select patient_id, min(on_date) as next_appt_on
  from appointments
  where status in ('booked', 'confirmed') and on_date >= current_date
  group by patient_id
),
spend as (
  select patient_id, sum(price_cents) as spend_cents_12m
  from appointments
  where status = 'completed' and on_date > current_date - 365
  group by patient_id
)
select p.id as patient_id, p.name, p.date_of_birth, p.phone, p.email, p.nhi,
       p.referral_source, p.marketing_opt_in, p.alerts, p.status,
       lv.last_visit_on,
       (current_date - lv.last_visit_on) as days_since_visit,
       na.next_appt_on,
       coalesce(s.spend_cents_12m, 0) as spend_cents_12m,
       round(r.usual_gap_days) as usual_gap_days,
       (r.usual_gap_days is not null
        and lv.last_visit_on is not null
        and (current_date - lv.last_visit_on) > r.usual_gap_days * 1.5
        and na.next_appt_on is null) as lapsed
from patients p
left join rhythm r on r.patient_id = p.id
left join last_visit lv on lv.patient_id = p.id
left join next_appt na on na.patient_id = p.id
left join spend s on s.patient_id = p.id;

create or replace view v_appointments as
select a.id, a.ref, a.on_date, a.starts_at, a.ends_at, a.status, a.cancel_reason,
       a.price_cents, a.note,
       a.patient_id, p.name as patient, p.phone as patient_phone, p.alerts as patient_alerts,
       a.practitioner_id, pr.name as practitioner, pr.discipline,
       a.service_id, s.name as service, s.kind as service_kind,
       a.case_id, c.ref as case_ref, c.title as case_title, c.funding, c.claim_number,
       tn.status as note_status
from appointments a
join patients p on p.id = a.patient_id
join practitioners pr on pr.id = a.practitioner_id
join services s on s.id = a.service_id
left join cases c on c.id = a.case_id
left join treatment_notes tn on tn.appointment_id = a.id;

-- Cases with their session arithmetic: completed sessions used, sessions
-- booked ahead, and what is left of the approval.
create or replace view v_cases as
select c.id, c.ref, c.title, c.funding, c.claim_number, c.injury_date,
       c.approved_sessions, c.referral_date, c.referral_expires_on, c.consent_recorded_on, c.status, c.opened_on,
       c.discharged_on, c.note,
       c.patient_id, p.name as patient,
       c.referrer_id, r.name as referrer, r.practice as referrer_practice,
       coalesce(u.used, 0) as sessions_used,
       coalesce(b.booked, 0) as sessions_booked,
       case when c.approved_sessions is null then null
            else c.approved_sessions - coalesce(u.used, 0) - coalesce(b.booked, 0)
       end as sessions_remaining
from cases c
join patients p on p.id = c.patient_id
left join referrers r on r.id = c.referrer_id
left join (
  select case_id, count(*) as used from (
    select case_id from appointments where status = 'completed'
    union all
    select ca.case_id from class_attendees ca where ca.status = 'attended'
  ) x where case_id is not null group by case_id
) u on u.case_id = c.id
left join (
  select case_id, count(*) as booked from (
    select case_id from appointments
    where status in ('booked', 'confirmed') and on_date >= current_date
    union all
    select ca.case_id from class_attendees ca join classes k on k.id = ca.class_id
    where ca.status = 'booked' and k.status = 'scheduled' and k.on_date >= current_date
  ) x where case_id is not null group by case_id
) b on b.case_id = c.id;

-- Completed appointments whose clinical record is not finalised: no note at
-- all, or a note still in draft. The first thing /attention raises.
create or replace view v_notes_due as
select a.id as appointment_id, a.ref, a.on_date,
       (current_date - a.on_date) as days_since,
       p.name as patient, pr.name as practitioner,
       s.name as service, c.ref as case_ref,
       coalesce(tn.status, 'missing') as note_state
from appointments a
join patients p on p.id = a.patient_id
join practitioners pr on pr.id = a.practitioner_id
join services s on s.id = a.service_id
left join cases c on c.id = a.case_id
left join treatment_notes tn on tn.appointment_id = a.id
where a.status = 'completed'
  and not a.imported
  and (tn.id is null or tn.status = 'draft');

create or replace view v_invoices as
select i.id, i.ref, i.payer, i.issued_on, i.due_on, i.status,
       i.patient_id, p.name as patient, i.case_id, c.ref as case_ref,
       coalesce(t.total_cents, 0) as total_cents,
       coalesce(pay.paid_cents, 0) as paid_cents,
       coalesce(t.total_cents, 0) - coalesce(pay.paid_cents, 0) as balance_cents,
       greatest(0, current_date - i.due_on) as days_overdue
from invoices i
join patients p on p.id = i.patient_id
left join cases c on c.id = i.case_id
left join (
  select invoice_id, sum(qty * unit_cents) as total_cents
  from invoice_items group by invoice_id
) t on t.invoice_id = i.id
left join (
  select invoice_id, sum(amount_cents) as paid_cents
  from payments group by invoice_id
) pay on pay.invoice_id = i.id;

-- Rebooking, last 28 days: of the visits each practitioner completed, how
-- many walked out holding (or later made) another appointment.
create or replace view v_rebooking as
select pr.id as practitioner_id, pr.name as practitioner,
       count(*) as visits,
       count(*) filter (where exists (
         select 1 from appointments later
         where later.patient_id = a.patient_id
           and later.status in ('booked', 'confirmed', 'completed')
           and later.on_date > a.on_date
       )) as rebooked
from appointments a
join practitioners pr on pr.id = a.practitioner_id
where a.status = 'completed' and a.on_date > current_date - 28
group by pr.id, pr.name;

create or replace view v_takings as
select a.on_date, pr.name as practitioner,
       count(*) as visits,
       sum(a.price_cents) as takings_cents
from appointments a
join practitioners pr on pr.id = a.practitioner_id
where a.status = 'completed'
group by a.on_date, pr.name;

-- DNA record, last 180 days, with the habit counted per patient.
create or replace view v_dnas as
select a.id, a.ref, a.on_date, p.name as patient, p.phone,
       pr.name as practitioner, s.name as service, a.price_cents,
       (select count(*) from appointments h
        where h.patient_id = a.patient_id and h.status = 'dna'
          and h.on_date > current_date - 180) as dnas_180
from appointments a
join patients p on p.id = a.patient_id
join practitioners pr on pr.id = a.practitioner_id
join services s on s.id = a.service_id
where a.status = 'dna' and a.on_date > current_date - 180;

create or replace view v_recalls as
select r.id, r.due_on, r.reason, r.status,
       (r.due_on - current_date) as days_until,
       p.name as patient, p.phone, p.marketing_opt_in,
       v.next_appt_on, v.spend_cents_12m
from recalls r
join patients p on p.id = r.patient_id
join v_patients v on v.patient_id = p.id
where r.status = 'open';

-- Referrers with the relationship state: how many cases each has sent, when
-- the last one landed, and who has gone quiet.
create or replace view v_referrers as
select r.id, r.name, r.practice, r.kind, r.phone, r.email,
       count(c.id) as cases_referred,
       max(c.referral_date) as last_referral_on,
       (current_date - max(c.referral_date)) as days_quiet
from referrers r
left join cases c on c.referrer_id = r.id
group by r.id, r.name, r.practice, r.kind, r.phone, r.email;

-- Claims with their age: how long each has sat ready or lodged, and whether
-- the visit's note is final (a claim never lodges before it is).
create or replace view v_claims as
select cl.id, cl.ref, cl.funder, cl.status, cl.service_on, cl.item_code,
       cl.amount_cents, cl.lodged_on, cl.paid_on, cl.reject_reason,
       cl.patient_id, p.name as patient,
       cl.case_id, c.ref as case_ref, c.claim_number,
       a.ref as appointment_ref, k.ref as class_ref,
       coalesce(pr.name, kp.name) as practitioner,
       i.ref as invoice_ref,
       case when cl.appointment_id is null then 'final' else coalesce(tn.status, 'missing') end as note_status,
       (current_date - cl.service_on) as days_since_service,
       case when cl.status = 'lodged' then current_date - cl.lodged_on end as days_lodged
from claims cl
join patients p on p.id = cl.patient_id
left join cases c on c.id = cl.case_id
left join appointments a on a.id = cl.appointment_id
left join practitioners pr on pr.id = a.practitioner_id
left join classes k on k.id = cl.class_id
left join practitioners kp on kp.id = k.practitioner_id
left join invoices i on i.id = cl.invoice_id
left join treatment_notes tn on tn.appointment_id = cl.appointment_id;

-- Treatment plans against reality: sessions done on the case since the plan
-- started, how many the agreed cadence says should be done by now, the
-- latest score against baseline and target, and whether a re-score is due.
create or replace view v_plans as
with done as (
  select tp.id as plan_id, count(x.on_date) as sessions_done, max(x.on_date) as last_session_on
  from treatment_plans tp
  left join (
    select case_id, on_date from appointments where status = 'completed'
    union all
    select ca.case_id, k.on_date from class_attendees ca join classes k on k.id = ca.class_id where ca.status = 'attended'
  ) x on x.case_id = tp.case_id and x.on_date >= tp.starts_on
  group by tp.id
),
nxt as (
  select case_id, min(on_date) as next_on from appointments
  where status in ('booked', 'confirmed') and on_date >= current_date group by case_id
),
latest as (
  select distinct on (plan_id) plan_id, score, on_date
  from outcome_scores order by plan_id, on_date desc, created_at desc
),
scored as (
  select plan_id, count(*) as scores from outcome_scores group by plan_id
)
select tp.id, tp.ref, tp.status, tp.goal, tp.measure, tp.higher_is_better,
       tp.baseline, tp.target, tp.planned_sessions, tp.every_days, tp.review_every,
       tp.starts_on, tp.closed_on, tp.note,
       tp.case_id, c.ref as case_ref, c.title as case_title, c.funding,
       tp.patient_id, p.name as patient, p.phone,
       pr.name as practitioner,
       coalesce(d.sessions_done, 0) as sessions_done,
       d.last_session_on,
       least(tp.planned_sessions, greatest(0, (current_date - tp.starts_on) / tp.every_days) + 1) as sessions_expected,
       n.next_on as next_booked_on,
       l.score as latest_score, l.on_date as latest_score_on,
       coalesce(sc.scores, 0) as scores_recorded,
       case when tp.target = tp.baseline then null
            else round(100 * (coalesce(l.score, tp.baseline) - tp.baseline) / (tp.target - tp.baseline))
       end as progress_pct,
       (select count(*) from appointments a2
        where a2.case_id = tp.case_id and a2.status = 'completed'
          and a2.on_date > coalesce(l.on_date, tp.starts_on - 1)) as sessions_since_score
from treatment_plans tp
join cases c on c.id = tp.case_id
join patients p on p.id = tp.patient_id
left join practitioners pr on pr.id = tp.practitioner_id
left join done d on d.plan_id = tp.id
left join nxt n on n.case_id = tp.case_id
left join latest l on l.plan_id = tp.id
left join scored sc on sc.plan_id = tp.id;

create or replace view v_classes as
select k.id, k.ref, k.on_date, k.starts_at, k.ends_at, k.capacity, k.status,
       s.name as service, s.price_cents, s.item_code, k.practitioner_id, pr.name as practitioner,
       count(ca.patient_id) filter (where ca.status in ('booked', 'attended')) as booked,
       count(ca.patient_id) filter (where ca.status = 'attended') as attended,
       count(ca.patient_id) filter (where ca.status = 'dna') as dnas,
       k.capacity - count(ca.patient_id) filter (where ca.status in ('booked', 'attended')) as spaces
from classes k
join services s on s.id = k.service_id
join practitioners pr on pr.id = k.practitioner_id
left join class_attendees ca on ca.class_id = k.id
group by k.id, k.ref, k.on_date, k.starts_at, k.ends_at, k.capacity, k.status,
         s.name, s.price_cents, s.item_code, k.practitioner_id, pr.name;

create or replace view v_passes as
select cp.id, cp.ref, cp.name, cp.classes_total, cp.price_cents, cp.bought_on, cp.expires_on,
       cp.patient_id, p.name as patient, p.phone, p.marketing_opt_in,
       count(ca.class_id) filter (where ca.status in ('attended', 'dna')) as classes_used,
       count(ca.class_id) filter (where ca.status = 'booked') as classes_booked,
       cp.classes_total - count(ca.class_id) filter (where ca.status in ('attended', 'dna', 'booked')) as classes_left,
       (cp.expires_on is not null and cp.expires_on < current_date) as expired
from class_passes cp
join patients p on p.id = cp.patient_id
left join class_attendees ca on ca.pass_id = cp.id
group by cp.id, cp.ref, cp.name, cp.classes_total, cp.price_cents, cp.bought_on, cp.expires_on,
         cp.patient_id, p.name, p.phone, p.marketing_opt_in;
