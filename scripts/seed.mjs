#!/usr/bin/env node
// Loads supabase/seed.sql: Bayfront Physio and Chiro, a fictional Tauranga
// clinic with five practitioners, fourteen patients, nine cases across ACC
// and private funding, sixteen weeks of visits behind and a booked week
// ahead, ACC claims at every stage, treatment plans, Pilates classes and
// passes. Every row has a derived id and inserts with ON
// CONFLICT DO NOTHING, so re-running it is harmless.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';

export async function seed(db) {
  const sql = readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(sql);
  const [c] = await db.query(`
    select (select count(*) from settings)           as settings,
           (select count(*) from practitioners)      as practitioners,
           (select count(*) from practitioner_hours) as practitioner_hours,
           (select count(*) from patients)           as patients,
           (select count(*) from referrers)          as referrers,
           (select count(*) from cases)              as cases,
           (select count(*) from services)           as services,
           (select count(*) from appointments)       as appointments,
           (select count(*) from treatment_notes)    as treatment_notes,
           (select count(*) from invoices)           as invoices,
           (select count(*) from payments)           as payments,
           (select count(*) from recalls)            as recalls,
           (select count(*) from waitlist)           as waitlist,
           (select count(*) from patient_notes)      as patient_notes,
           (select count(*) from claims)             as claims,
           (select count(*) from treatment_plans)    as treatment_plans,
           (select count(*) from outcome_scores)     as outcome_scores,
           (select count(*) from classes)            as classes,
           (select count(*) from class_attendees)    as class_attendees,
           (select count(*) from class_passes)       as class_passes
  `);
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Number(v)]));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const db = await getDb();
  try {
    const counts = await seed(db);
    console.log('seeded:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
  } finally {
    await db.close();
  }
}
