---
description: Record a funder remittance - mark claims paid (or short paid, or rejected with the reason) so the ACC, Medicare and DVA lines on the debtors list are true.
---

1. Ask for the remittance: which claims, what amount each, or which came back rejected and why. Match partial refs and patient names with `claims --status=lodged --json`.
2. For each paid claim: `node scripts/clinic.mjs claim paid CLM-... [--amount=55 --on=DATE] --json`. A short payment is recorded as what was actually paid; say the shortfall out loud.
3. For each rejection: `node scripts/clinic.mjs claim reject CLM-... --reason="<the funder's words>"`.
4. Finish with `claims --status=lodged` so the operator sees what is still outstanding.
