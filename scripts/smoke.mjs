#!/usr/bin/env node
// End-to-end smoke test on a throwaway embedded database.
// Runs migrate, seed, then every CLI command that matters, and asserts on the JSON.
// Passes on Windows and Linux. No network, no Postgres install.
//
// The seed anchors everything to current_date offsets, so every assertion
// here holds whatever day you run it.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'clinic-smoke-'));
const scratch = mkdtempSync(path.join(tmpdir(), 'clinic-smoke-files-'));
const env = { ...process.env, DATA_DIR: dataDir };
delete env.DATABASE_URL; // the smoke test always runs embedded

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json && !expectFail ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\nFAIL assertion: ${msg}`);
    process.exit(1);
  }
}

const n = (v) => Number(v ?? 0);
const iso = (d) => {
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDays = (base, days) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
const now = new Date();
const day = (offset) => iso(addDays(now, offset));

console.log(`smoke: data dir ${dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the numbers, before anything moves ------------------------------------

  const stats = run('stats', ['clinic.mjs', 'stats']);
  assert(n(stats.active_patients) === 14, `fourteen patients on the book (${stats.active_patients})`);
  assert(n(stats.practitioners) === 5, `five on the team (${stats.practitioners})`);
  assert(n(stats.open_cases) === 8, `eight open cases (${stats.open_cases})`);
  assert(n(stats.booked_ahead) === 7, `seven bookings ahead (${stats.booked_ahead})`);
  assert(n(stats.unconfirmed_soon) === 1, `one unconfirmed inside the window (${stats.unconfirmed_soon})`);
  assert(n(stats.not_completed) === 1, `one visit left open past its day (${stats.not_completed})`);
  assert(n(stats.notes_missing) === 2, `two clinical records not finalised (${stats.notes_missing})`);
  assert(n(stats.funded_at_limit) === 1, `one funded case fully committed (${stats.funded_at_limit})`);
  assert(n(stats.consent_missing) === 1, `one treated case with no consent (${stats.consent_missing})`);
  assert(n(stats.dnas_30) === 1, `one DNA this month (${stats.dnas_30})`);
  assert(n(stats.lapsed) === 2, `two lapsed patients (${stats.lapsed})`);
  assert(n(stats.recalls_due) === 1, `one recall due (${stats.recalls_due})`);
  assert(n(stats.waitlist) === 1, `one patient waiting (${stats.waitlist})`);
  assert(n(stats.referrers_quiet) === 1, `one referrer gone quiet (${stats.referrers_quiet})`);
  assert(n(stats.debtors_cents) === 21000, `patients owe $210 past due (${stats.debtors_cents})`);
  assert(n(stats.funder_unpaid_cents) === 18500, `ACC owes $185 on INV-2002 (${stats.funder_unpaid_cents})`);
  assert(n(stats.takings_7d_cents) === 43500, `the week took $435 (${stats.takings_7d_cents})`);
  assert(n(stats.claims_ready) === 5 && n(stats.claims_ready_cents) === 27500, `five claims, $275, ready and not lodged (${stats.claims_ready}, ${stats.claims_ready_cents})`);
  assert(n(stats.claims_blocked) === 1, `one claim held back by a missing note (${stats.claims_blocked})`);
  assert(n(stats.claims_lodged_cents) === 24000, `$240 lodged and waiting (${stats.claims_lodged_cents})`);
  assert(n(stats.claims_rejected) === 1, `one rejected claim (${stats.claims_rejected})`);
  assert(n(stats.active_plans) === 5, `five treatment plans running (${stats.active_plans})`);
  assert(n(stats.plans_nothing_booked) === 2, `two plans with nothing booked (${stats.plans_nothing_booked})`);
  assert(n(stats.classes_ahead) === 2, `two classes ahead (${stats.classes_ahead})`);
  assert(n(stats.class_fill_pct_28) === 71, `classes ran 71% full (${stats.class_fill_pct_28})`);
  assert(n(stats.rebooking_pct_28) === 87, `thirteen of fifteen visits left rebooked (${stats.rebooking_pct_28})`);

  // ---- attention: every deliberate mess in the seed fires ---------------------

  const attention = run('attention', ['clinic.mjs', 'attention']);
  const reasons = new Set(attention.map((r) => r.reason));
  for (const expected of ['note_missing', 'funded_sessions', 'consent_missing', 'claim_rejected', 'claim_blocked',
    'not_completed', 'claims_ready', 'unconfirmed', 'plan_dropout', 'dna', 'plan_stalled', 'overdue_invoice',
    'claim_unpaid', 'rescore_due', 'lapsed', 'recall_due', 'pass_expiring', 'pass_used_up', 'class_full',
    'waitlist', 'referrer_quiet']) {
    assert(reasons.has(expected), `attention includes ${expected} (${[...reasons].join(', ')})`);
  }
  assert(attention[0].reason === 'note_missing', 'the unwritten clinical record outranks everything');
  assert(attention.filter((r) => r.reason === 'note_missing').length === 2, 'Grace and David both flagged');
  assert(attention.filter((r) => r.reason === 'lapsed').length === 2, 'Sarah and Mike both raised');
  assert(!reasons.has('funder_unpaid'), 'a funder invoice already tracked by its claims is not raised twice');
  assert(attention.filter((r) => r.reason === 'plan_dropout').map((r) => r.who).sort().join() === 'Grace Muller,Rex Morton', 'Rex and Grace are quietly dropping out');
  assert(/5 ACC claim\(s\) worth \$275/.test(attention.find((r) => r.reason === 'claims_ready').detail), 'the ready claims are one line with the money on it');
  assert(attention.length === 25, `twenty-five decisions on the list (${attention.length})`);

  // ---- the diary ----------------------------------------------------------------

  const tomorrow = run('the day sheet, tomorrow', ['clinic.mjs', 'day', `--date=${day(1)}`]);
  assert(tomorrow.length === 2, `two visits tomorrow (${tomorrow.length})`);
  assert(tomorrow.find((a) => a.ref === 'APT-1961').state === 'UNCONFIRMED', `Priya's silence is loud`);
  assert(tomorrow.find((a) => a.ref === 'APT-1116').state === 'confirmed', `Liam's last approved session is quiet`);
  assert(tomorrow.find((a) => a.ref === 'APT-1116').funding === 'acc', `and carries its funding`);

  const week = run('the diary, the week', ['clinic.mjs', 'book']);
  assert(week.length === 5, `the week holds five of the seven bookings ahead (${week.length})`);

  const gaps = run('the empty diary', ['clinic.mjs', 'gaps']);
  const tomorrowGaps = gaps.filter((g) => g.on_date === day(1));
  assert(tomorrowGaps.length === 5, `five practitioners have windows tomorrow (${tomorrowGaps.length})`);
  assert(n(tomorrowGaps.find((g) => g.practitioner === 'Kate Manaia').booked_minutes) === 30, `Kate holds Liam's session 16`);
  assert(n(tomorrowGaps.find((g) => g.practitioner === 'Aroha Ngata').booked_minutes) === 45, `Aroha's Pilates class fills her diary too`);

  // ---- patients -------------------------------------------------------------------

  const patients = run('the patient book', ['clinic.mjs', 'patients']);
  assert(patients.length === 14, `fourteen patients (${patients.length})`);

  const sarah = run('patient card by partial name', ['clinic.mjs', 'patient', 'sar']);
  assert(sarah.patient.name === 'Sarah Holt', 'resolved by partial name');
  assert(sarah.patient.lapsed === true, 'Sarah reads as lapsed');
  assert(n(sarah.patient.usual_gap_days) === 21, `her rhythm is 21 days (${sarah.patient.usual_gap_days})`);
  assert(n(sarah.patient.spend_cents_12m) === 42000, `she spent $420 this year (${sarah.patient.spend_cents_12m})`);

  const liam = run('the ACC case on the patient card', ['clinic.mjs', 'patient', 'liam']);
  assert(liam.cases.length === 1 && liam.cases[0].ref === 'CASE-101', `Liam carries CASE-101`);
  assert(n(liam.cases[0].sessions_used) === 15 && n(liam.cases[0].approved_sessions) === 16, `15 of 16 used`);

  run('an unknown patient exits 1', ['clinic.mjs', 'patient', 'nobody at all'], { json: false, expectFail: true });
  run('an ambiguous name lists and exits 1', ['clinic.mjs', 'confirm', 'not-a-ref'], { json: false, expectFail: true });

  // ---- the gates refuse, and say why ------------------------------------------------

  run('ACC gate: session 17 of 16 refuses', ['clinic.mjs', 'book', 'add', 'Liam', 'Kate',
    '--service=Physiotherapy follow-up', `--date=${day(2)}`, '--at=9:00', '--case=CASE-101'], { json: false, expectFail: true });
  run('hours gate: 6am refuses', ['clinic.mjs', 'book', 'add', 'Oliver', 'Kate',
    '--service=Physiotherapy follow-up', `--date=${day(1)}`, '--at=6:00'], { json: false, expectFail: true });
  run('double-book gate refuses', ['clinic.mjs', 'book', 'add', 'Oliver', 'Kate',
    '--service=Physiotherapy follow-up', `--date=${day(1)}`, '--at=9:00'], { json: false, expectFail: true });
  run('a booking over a class refuses', ['clinic.mjs', 'book', 'add', 'Oliver', 'Aroha',
    '--service=Physiotherapy follow-up', `--date=${day(1)}`, '--at=12:15'], { json: false, expectFail: true });

  const extended = run('the ACC32 outcome lands', ['clinic.mjs', 'case', 'extend', 'CASE-101', '--sessions=4', '--note=ACC32 approved']);
  assert(n(extended.approved_sessions) === 20, `approval is now 20 (${extended.approved_sessions})`);
  const booked17 = run('and session 17 books', ['clinic.mjs', 'book', 'add', 'Liam', 'Kate',
    '--service=Physiotherapy follow-up', `--date=${day(2)}`, '--at=9:00', '--case=CASE-101']);
  assert(booked17.ref === 'APT-1982', `refs mint in order (${booked17.ref})`);

  // A Medicare care plan is a hard line too.
  run('an EPC case with no session count refuses', ['clinic.mjs', 'case', 'add', 'Priya', '--title=Neck pain', '--funding=epc'],
    { json: false, expectFail: true });
  run('a care plan with no GP refuses', ['clinic.mjs', 'case', 'add', 'Priya', '--title=Neck pain', '--funding=epc', '--sessions=1'],
    { json: false, expectFail: true });
  run('open the care plan case', ['clinic.mjs', 'case', 'add', 'Priya', '--title=Neck pain, GP care plan', '--funding=epc', '--sessions=1', '--claim=EPC 2026', '--referrer=Weber', '--consent'], { json: false });
  const epcBook = run('the plan\'s one session books, with a warning', ['clinic.mjs', 'book', 'add', 'Priya', 'Tom',
    '--service=Physiotherapy follow-up', `--date=${day(3)}`, '--at=9:00', '--case=CASE-109']);
  assert(epcBook.warnings.length === 1, `the last-session warning fires (${JSON.stringify(epcBook.warnings)})`);
  run('the plan\'s second session refuses', ['clinic.mjs', 'book', 'add', 'Priya', 'Tom',
    '--service=Physiotherapy follow-up', `--date=${day(4)}`, '--at=9:00', '--case=CASE-109'], { json: false, expectFail: true });

  // The five-a-year Medicare line holds across care plans.
  run('a second care plan case', ['clinic.mjs', 'case', 'add', 'Priya', '--title=Low back, second GP plan', '--funding=epc', '--sessions=5', '--referrer=Weber', '--consent'], { json: false });
  run('the year cap drops to two for the test', ['clinic.mjs', 'settings', 'set', 'cdm_year_cap', '2'], { json: false });
  const capYear = day(10).slice(0, 4) === day(3).slice(0, 4) ? day(10) : day(3);
  if (capYear === day(10)) {
    run('the second care plan visit this year books', ['clinic.mjs', 'book', 'add', 'Priya', 'Tom',
      '--service=Physiotherapy follow-up', `--date=${day(10)}`, '--at=9:00', '--case=CASE-110'], { json: false });
    run('the third in the calendar year refuses', ['clinic.mjs', 'book', 'add', 'Priya', 'Tom',
      '--service=Physiotherapy follow-up', `--date=${day(11)}`, '--at=9:00', '--case=CASE-110'], { json: false, expectFail: true });
  }
  run('the cap goes back to five', ['clinic.mjs', 'settings', 'set', 'cdm_year_cap', '5'], { json: false });

  // A DVA treatment cycle: 12 sessions or a year, and never a gap.
  run('a DVA case over 12 sessions refuses', ['clinic.mjs', 'case', 'add', 'Rex', '--title=Veteran knee', '--funding=dva', '--sessions=14', '--referrer=Weber'],
    { json: false, expectFail: true });
  run('the DVA cycle opens a year back', ['clinic.mjs', 'case', 'add', 'Rex', '--title=Veteran knee, DVA', '--funding=dva', '--claim=QX123456',
    '--referrer=Weber', `--referral-date=${day(-360)}`, '--consent'], { json: false });
  const dvaCase = run('the cycle carries 12 sessions and its expiry', ['clinic.mjs', 'case', 'CASE-111']);
  assert(n(dvaCase.approved_sessions) === 12, `12 sessions (${dvaCase.approved_sessions})`);
  run('past the referral expiry refuses', ['clinic.mjs', 'book', 'add', 'Rex', 'Tom',
    '--service=Physiotherapy follow-up', `--date=${day(7)}`, '--at=15:00', '--case=CASE-111'], { json: false, expectFail: true });
  run('a DVA cycle never extends', ['clinic.mjs', 'case', 'extend', 'CASE-111', '--sessions=2'], { json: false, expectFail: true });
  const dvaApt = run('inside the cycle books', ['clinic.mjs', 'book', 'add', 'Rex', 'Tom',
    '--service=Physiotherapy follow-up', `--date=${day(0)}`, '--at=15:00', '--case=CASE-111']);
  const dvaDone = run('the DVA visit bills DVA and only DVA', ['clinic.mjs', 'complete', dvaApt.ref]);
  assert(dvaDone.invoices.length === 1 && dvaDone.invoices[0].payer === 'dva', `one invoice, to DVA (${JSON.stringify(dvaDone.invoices)})`);
  assert(dvaDone.claim && dvaDone.claim.funder === 'dva' && n(dvaDone.claim.amount_cents) === 5500, 'and its claim is ready');

  // An ACC visit splits: ACC's contribution on the claim, the surcharge on its own invoice.
  const accApt = run('an ACC visit books', ['clinic.mjs', 'book', 'add', 'Rex', 'Tom',
    '--service=Physiotherapy follow-up', `--date=${day(0)}`, '--at=16:00', '--case=CASE-104']);
  const accDone = run('and completes into two invoices and a claim', ['clinic.mjs', 'complete', accApt.ref]);
  assert(accDone.invoices.length === 2, `two invoices (${accDone.invoices.length})`);
  assert(accDone.invoices[0].payer === 'acc' && n(accDone.invoices[0].total_cents) === 5500, 'ACC gets its $55 contribution');
  assert(accDone.invoices[1].payer === 'patient' && n(accDone.invoices[1].total_cents) === 3000, 'Rex gets the $30 surcharge, separately');
  assert(n(accDone.claim.amount_cents) === 5500, 'the ACC claim carries only ACC\'s part');
  run('a claim with no final note will not lodge', ['clinic.mjs', 'claim', 'lodge', accDone.claim.ref], { json: false, expectFail: true });
  run('the note', ['clinic.mjs', 'note', 'add', accApt.ref, '--s=Shoulder easier at work', '--o=Flexion 160', '--a=Improving', '--p=Progress load'], { json: false });
  run('finalised', ['clinic.mjs', 'note', 'final', accApt.ref], { json: false });

  // ---- claims ----------------------------------------------------------------------------

  const ready = run('claims ready', ['clinic.mjs', 'claims', '--ready']);
  assert(ready.filter((c) => !c.blocked).length === 6, `six lodgeable: five from the seed and Rex's ACC visit (${ready.filter((c) => !c.blocked).length})`);
  const blocked = ready.filter((c) => c.blocked);
  assert(blocked.length === 2, `Grace's missing note and today's DVA note hold two back (${blocked.map((c) => c.ref).join(', ')})`);
  const lodged = run('lodge the batch', ['clinic.mjs', 'claim', 'lodge', '--ready']);
  assert(lodged.lodged.length === 6 && lodged.refused.length === 2, `six lodge, two refused (${lodged.lodged.length}, ${lodged.refused.length})`);
  assert(lodged.refused.some((r) => r.ref === 'CLM-3024' && /note is missing/.test(r.why)), 'Grace\'s claim names its missing note');
  const paidClaim = run('ACC pays Rex\'s first claim', ['clinic.mjs', 'claim', 'paid', 'CLM-3016']);
  assert(paidClaim.status === 'paid', 'paid');
  const inv2002 = run('and the ACC invoice moves', ['clinic.mjs', 'invoices', '--unpaid']);
  assert(n(inv2002.find((i) => i.ref === 'INV-2002').balance_cents) === 11000, 'INV-2002 is down to $110');
  run('a paid claim cannot be paid twice', ['clinic.mjs', 'claim', 'paid', 'CLM-3016'], { json: false, expectFail: true });
  run('the rejected claim relodges once fixed', ['clinic.mjs', 'claim', 'lodge', 'CLM-3019'], { json: false });
  run('a rejection needs the funder\'s reason', ['clinic.mjs', 'claim', 'reject', 'CLM-3017'], { json: false, expectFail: true });
  run('and records it', ['clinic.mjs', 'claim', 'reject', 'CLM-3017', '--reason=Duplicate of an earlier invoice'], { json: false });
  const rejected = run('rejections list', ['clinic.mjs', 'claims', '--status=rejected']);
  assert(rejected.length === 1 && rejected[0].reject_reason === 'Duplicate of an earlier invoice', 'the funder\'s words are kept');

  // ---- treatment plans -------------------------------------------------------------------------

  const plans = run('plans', ['clinic.mjs', 'plans']);
  assert(plans.length === 5, `five plans (${plans.length})`);
  const rex = plans.find((p) => p.ref === 'PLAN-402');
  assert(/DROPPING OUT/.test(rex.state) && /RE-SCORE DUE/.test(rex.state) && /STALLED/.test(rex.state), `Rex is behind, unscored and stalled (${rex.state})`);
  assert(n(rex.behind) === 2, `two behind, even with today's visit (${rex.behind})`);
  const liamPlan = plans.find((p) => p.ref === 'PLAN-401');
  assert(liamPlan.state === 'on track' && n(liamPlan.progress_pct) === 86, `Liam is 86% of the way (${liamPlan.progress_pct})`);
  const scored = run('Rex re-scored', ['clinic.mjs', 'plan', 'score', 'PLAN-402', '--score=33']);
  assert(n(scored.progress_pct) === 51, `QuickDASH 52 to 33 is 51% of the way to 15 (${scored.progress_pct})`);
  const rexPlan = run('the plan card', ['clinic.mjs', 'plan', 'Rex']);
  assert(rexPlan.scores.length === 3, `three scores on record (${rexPlan.scores.length})`);
  run('a plan without its numbers refuses', ['clinic.mjs', 'plan', 'add', 'CASE-103', '--goal=Headache free'], { json: false, expectFail: true });
  const newPlan = run('Nathan\'s plan', ['clinic.mjs', 'plan', 'add', 'CASE-103', '--goal=A week without a headache', '--measure=NDI',
    '--baseline=30', '--target=10', '--sessions=6', '--lower-better', '--practitioner=Marcus']);
  assert(newPlan.ref === 'PLAN-406', `refs mint in order (${newPlan.ref})`);
  const met = run('David hits his target', ['clinic.mjs', 'plan', 'score', 'PLAN-404', '--score=0']);
  assert(met.target_met === true, 'target met');
  run('and his plan closes', ['clinic.mjs', 'plan', 'close', 'PLAN-404', '--achieved'], { json: false });

  // ---- classes and passes --------------------------------------------------------------------

  const classes = run('the timetable', ['clinic.mjs', 'classes']);
  assert(classes.length === 2 && classes.find((k) => k.ref === 'CLS-505').state === 'FULL', 'tomorrow is full');
  run('a full class refuses', ['clinic.mjs', 'class', 'book', 'CLS-505', 'Grace'], { json: false, expectFail: true });
  run('an expired pass refuses', ['clinic.mjs', 'class', 'book', 'CLS-506', 'Hannah', '--pass'], { json: false, expectFail: true });
  run('a used-up pass refuses', ['clinic.mjs', 'class', 'book', 'CLS-506', 'Ellen', '--pass'], { json: false, expectFail: true });
  const sold = run('Ellen buys the next pass', ['clinic.mjs', 'pass', 'add', 'Ellen', '--classes=10', '--price=300']);
  assert(sold.ref === 'PASS-604', `the pass mints (${sold.ref})`);
  const onPass = run('and books on it', ['clinic.mjs', 'class', 'book', 'CLS-506', 'Ellen', '--pass']);
  assert(onPass.pass === 'PASS-604', `the new pass is used, not the old (${onPass.pass})`);
  run('a class that is not a class service refuses', ['clinic.mjs', 'class', 'add', 'Physiotherapy follow-up', '--practitioner=Aroha', `--date=${day(0)}`, '--at=13:00'], { json: false, expectFail: true });
  const todayClass = run('a class today', ['clinic.mjs', 'class', 'add', 'Clinical Pilates', '--practitioner=Aroha', `--date=${day(0)}`, '--at=13:00', '--capacity=2']);
  run('Priya on her pass', ['clinic.mjs', 'class', 'book', todayClass.ref, 'Priya', '--pass'], { json: false });
  run('Sarah pays on the day', ['clinic.mjs', 'class', 'book', todayClass.ref, 'Sarah'], { json: false });
  run('a third into a class of two refuses', ['clinic.mjs', 'class', 'book', todayClass.ref, 'Oliver'], { json: false, expectFail: true });
  const roll = run('the roll', ['clinic.mjs', 'class', 'run', todayClass.ref]);
  assert(roll.attended.length === 2 && roll.dna.length === 0, 'both came');
  const sarahCard = run('Sarah was invoiced for the class, Priya was not', ['clinic.mjs', 'patient', 'Sarah']);
  assert(sarahCard.owing.some((i) => n(i.balance_cents) === 3500), 'a $35 class invoice for Sarah');
  const passes = run('passes', ['clinic.mjs', 'passes']);
  assert(n(passes.find((p) => p.ref === 'PASS-602').left) === 5, `Priya has five left (${passes.find((p) => p.ref === 'PASS-602').left})`);

  // ---- consent, complete, the note lifecycle -----------------------------------------

  run('a case opens for the walk-in', ['clinic.mjs', 'case', 'add', 'Oliver', '--title=Right calf strain'], { json: false });
  const oliverApt = run('the walk-in books today', ['clinic.mjs', 'book', 'add', 'Oliver', 'Aroha',
    '--service=Physiotherapy follow-up', `--date=${day(0)}`, '--at=10:00', '--case=CASE-112']);
  run('completing without consent refuses', ['clinic.mjs', 'complete', oliverApt.ref], { json: false, expectFail: true });
  run('consent recorded', ['clinic.mjs', 'case', 'consent', 'CASE-112'], { json: false });
  const completed = run('the visit completes and invoices', ['clinic.mjs', 'complete', oliverApt.ref]);
  assert(completed.invoice && completed.invoice.ref === 'INV-2010', `the invoice minted (${JSON.stringify(completed.invoice)})`);
  assert(completed.claim === null, 'a private visit makes no claim');
  assert(completed.invoice.payer === 'patient', 'a private case bills the patient');

  run('finalising an empty note refuses', ['clinic.mjs', 'note', 'final', oliverApt.ref], { json: false, expectFail: true });
  run('the note drafts', ['clinic.mjs', 'note', 'add', oliverApt.ref,
    '--s=Calf tight after football', '--o=Single leg raise 15 reps', '--a=Grade 1 strain resolving', '--p=Progress loading next week'], { json: false });
  run('the note finalises', ['clinic.mjs', 'note', 'final', oliverApt.ref], { json: false });
  run('editing a final note refuses', ['clinic.mjs', 'note', 'add', oliverApt.ref, '--s=quiet edit'], { json: false, expectFail: true });
  run('the addendum is the only door', ['clinic.mjs', 'note', 'addendum', oliverApt.ref, 'Patient rang: mild soreness next day, settled.'], { json: false });
  const oliverNotes = run('the record shows it', ['clinic.mjs', 'notes', 'Oliver']);
  assert(oliverNotes.length === 1 && oliverNotes[0].status === 'final' && /settled/.test(oliverNotes[0].addendum), 'final note with dated addendum');

  // Grace's missing note gets written, and the attention list heals.
  run('Grace\'s note, written late but written', ['clinic.mjs', 'note', 'add', 'APT-1903',
    '--s=Elbow settling, gripping better', '--o=Pain-free grip 28kg', '--a=Improving', '--p=Two more sessions'], { json: false });
  run('and finalised', ['clinic.mjs', 'note', 'final', 'APT-1903'], { json: false });
  const graceClaim = run('and Grace\'s held-back claim lodges now', ['clinic.mjs', 'claim', 'lodge', 'CLM-3024']);
  assert(graceClaim.lodged.length === 1, 'the note unlocked the money');
  const notesDue = run('two records still owing', ['clinic.mjs', 'notes-due']);
  assert(notesDue.map((r) => r.ref).sort().join() === `APT-1803,${dvaApt.ref}`, `David's draft and today's DVA visit remain (${JSON.stringify(notesDue.map((r) => r.ref))})`);
  run('today\'s DVA note', ['clinic.mjs', 'note', 'add', dvaApt.ref, '--s=Knee better on stairs', '--o=Squat to 90', '--a=Improving', '--p=Continue'], { json: false });
  run('finalised', ['clinic.mjs', 'note', 'final', dvaApt.ref], { json: false });

  // ---- DNA, cancel, confirm -----------------------------------------------------------

  run('confirm', ['clinic.mjs', 'confirm', 'APT-1961'], { json: false });
  run('a future DNA refuses', ['clinic.mjs', 'dna', 'APT-1404'], { json: false, expectFail: true });
  run('a cancellation without a reason refuses', ['clinic.mjs', 'cancel', 'APT-1404'], { json: false, expectFail: true });
  run('a cancellation with its reason lands', ['clinic.mjs', 'cancel', 'APT-1404', '--reason=Patient away for work'], { json: false });
  const hannah = run('the open visit resolves as DNA', ['clinic.mjs', 'dna', 'APT-1971']);
  assert(n(hannah.dnas_180) === 1, `Hannah's first (${hannah.dnas_180})`);

  // ---- money ---------------------------------------------------------------------------

  run('overpaying refuses', ['clinic.mjs', 'pay', 'INV-2001', '--amount=500'], { json: false, expectFail: true });
  const part = run('a part payment lands', ['clinic.mjs', 'pay', 'INV-2001', '--amount=110']);
  assert(n(part.balance_cents) === 10000, `$100 still owing (${part.balance_cents})`);
  const paid = run('the rest pays it off', ['clinic.mjs', 'pay', 'INV-2001', '--amount=100']);
  assert(paid.status === 'paid', 'INV-2001 is done');
  const debtors = run('debtors', ['clinic.mjs', 'debtors']);
  assert(n(debtors.funder_cents) === 11000 + 5500 + 5500, `ACC owes $110 + $55, DVA $55 (${debtors.funder_cents})`);
  assert(debtors.owing.every((r) => r.ref !== 'INV-2001'), 'Ellen is off the list');

  const takings = run('takings', ['clinic.mjs', 'takings']);
  assert(n(takings.total_cents) === 43500 + 8500 * 3, `the week's takings moved with Oliver's and Rex's visits (${takings.total_cents})`);

  // ---- recalls, waitlist, referrers ------------------------------------------------------

  const recalls = run('recalls', ['clinic.mjs', 'recalls']);
  assert(recalls.length === 1 && recalls[0].patient === 'June Kereama', 'June is due');
  run('recall done', ['clinic.mjs', 'recall', 'done', 'June'], { json: false });
  run('recall add', ['clinic.mjs', 'recall', 'add', 'June', `--due=${day(365)}`, '--reason=Hip OA annual strength review'], { json: false });

  run('waitlist remove --booked', ['clinic.mjs', 'waitlist', 'remove', 'Oliver', '--booked'], { json: false });
  const waitlist = run('the waitlist is clear', ['clinic.mjs', 'waitlist']);
  assert(waitlist.length === 0, `nobody waiting (${waitlist.length})`);

  const referrers = run('referrers', ['clinic.mjs', 'referrers']);
  const teAro = referrers.find((r) => r.name === 'Te Aro Health');
  assert(teAro.state === 'GONE QUIET' && n(teAro.days_quiet) === 95, `Te Aro Health has gone quiet (${teAro.days_quiet})`);

  // ---- compliance -----------------------------------------------------------------------

  const compliance = run('compliance', ['clinic.mjs', 'compliance']);
  assert(compliance.length === 9, `nine rules (${compliance.length})`);
  const byRule = Object.fromEntries(compliance.map((c) => [c.rule, c]));
  assert(byRule.records.ok === false, 'the records rule fails while David\'s draft stands');
  assert(byRule.consent.ok === false, 'the consent rule fails while Amelia\'s case stands');
  assert(byRule['funded-sessions'].ok === true, 'no funded case is past its approval');
  assert(byRule.retention.ok === true, 'nothing has been deleted');
  assert(byRule['claims-evidence'].ok === true, 'no claim went out without its note');
  assert(byRule['funder-billing'].ok === true, 'no DVA gap, no surcharge inside an ACC claim');
  assert(byRule.referrals.ok === true, 'nothing on an expired referral, nobody over the care plan cap');
  assert(compliance.every((c) => /docs\/compliance\.md/.test(c.source)), 'every rule cites its source');

  // Fix the two failures the way the rule book says, and watch it heal.
  run('David\'s draft finalises', ['clinic.mjs', 'note', 'final', 'APT-1803'], { json: false });
  run('Amelia\'s consent is recorded', ['clinic.mjs', 'case', 'consent', 'CASE-102'], { json: false });
  const healed = run('compliance heals', ['clinic.mjs', 'compliance']);
  assert(healed.filter((c) => !c.ok).length === 0, `every rule passes (${healed.filter((c) => !c.ok).map((c) => c.rule).join(', ')})`);

  // ---- team, services, settings -----------------------------------------------------------

  const team = run('the team', ['clinic.mjs', 'team']);
  assert(team.length === 5, `five practitioners (${team.length})`);
  run('practitioner add', ['clinic.mjs', 'practitioner', 'add', 'Sam Field', '--discipline=physiotherapist'], { json: false });
  run('practitioner hours', ['clinic.mjs', 'practitioner', 'hours', 'Sam Field', 'mon', '--start=8:00', '--end=12:00'], { json: false });
  const services = run('services', ['clinic.mjs', 'services']);
  assert(services.length === 7, `seven services (${services.length})`);
  run('a class service with its code', ['clinic.mjs', 'service', 'add', 'Hydrotherapy group', '--minutes=45', '--price=30', '--code=HYD-C', '--class', '--capacity=8'], { json: false });
  run('settings set', ['clinic.mjs', 'settings', 'set', 'note_due_days', '3'], { json: false });

  // ---- import from Nookal, dry run first ---------------------------------------------------

  const patientsCsv = path.join(scratch, 'clients.csv');
  writeFileSync(patientsCsv, [
    'First Name,Last Name,DOB,Email,Mobile,Referral Source',
    'Zoe,Adams,14/02/1991,zoe.adams@example.com,021 555 0999,Google',
    'Sarah,Holt,,sarah.holt@example.com,,word of mouth',
    ',,,no-name@example.com,,',
  ].join('\n'));
  const apptsCsv = path.join(scratch, 'appointments.csv');
  writeFileSync(apptsCsv, [
    'Client,Starts at,Appointment Type,Provider,Duration,Price',
    `Zoe Adams,${day(-30)} 10:00,Initial physiotherapy consult,Kate Manaia,45,110`,
    `Zoe Adams,${day(9)} 10:00,Physiotherapy follow-up,Kate Manaia,30,85`,
    `Zoe Adams,,Physiotherapy follow-up,Kate Manaia,30,85`,
    `Zoe Adams,${day(11)} 14:00,Physiotherapy follow-up,Somebody Unknown,30,85`,
  ].join('\n'));

  const dry = run('import: dry run first', ['clinic.mjs', 'import', 'nookal', `--patients=${patientsCsv}`, `--appointments=${apptsCsv}`, '--dry-run']);
  assert(dry.dry_run === true && dry.created.some((c) => c.what === 'patient' && c.name === 'Zoe Adams'), 'the dry run names who would land');
  assert(dry.skipped.some((s) => /missing date/.test(s.why)), `and names the row with no date (${JSON.stringify(dry.skipped.map((s) => s.why))})`);
  assert(dry.skipped.some((s) => /Somebody Unknown/.test(s.why)), 'and the practitioner nobody knows');

  const before = run('nothing was written', ['clinic.mjs', 'stats']);
  assert(n(before.active_patients) === 14, `still fourteen after the dry run (${before.active_patients})`);

  const imported = run('import for real', ['clinic.mjs', 'import', 'nookal', `--patients=${patientsCsv}`, `--appointments=${apptsCsv}`]);
  assert(imported.created.some((c) => c.what === 'patient' && c.name === 'Zoe Adams'), 'Zoe Adams arrived');
  assert(imported.created.some((c) => c.what === 'service' && c.name === 'Initial physiotherapy consult'), 'her old service arrived with her');
  assert(imported.updated.some((u) => u.what === 'patient' && u.name === 'Sarah Holt'), 'Sarah matched, not duplicated');

  const again = run('import again (idempotent)', ['clinic.mjs', 'import', 'nookal', `--patients=${patientsCsv}`, `--appointments=${apptsCsv}`]);
  assert(!again.created.some((c) => c.what === 'appointment'), `the second pass books nothing new (${JSON.stringify(again.created.filter((c) => c.what === 'appointment'))})`);

  const zoe = run('and Zoe was never opted in by a spreadsheet', ['clinic.mjs', 'patient', 'Zoe']);
  assert(zoe.patient.marketing_opt_in === null, 'the marketing question gets asked fresh, not assumed');
  const afterImport = run('imported history does not owe notes', ['clinic.mjs', 'notes-due']);
  assert(afterImport.every((r) => !/Zoe/.test(r.patient)), 'the old system\'s notes live in its own export');

  // ---- export -------------------------------------------------------------------------------

  const exported = run('export', ['clinic.mjs', 'export', `--out=${path.join(scratch, 'out')}`]);
  assert(exported.written.length === 11, `eleven files (${exported.written.length})`);
  for (const w of exported.written) {
    assert(existsSync(path.join(scratch, 'out', w.file)), `${w.file} exists`);
    assert(readFileSync(path.join(scratch, 'out', w.file), 'utf8').split('\n').length > 2, `${w.file} has rows`);
  }

  console.log(`\nPASS: ${step} steps.`);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
}
