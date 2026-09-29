---
description: The service list - what the clinic offers, how long each takes, what each costs. Bookings and invoices read from here.
---

1. Run `node scripts/clinic.mjs services --json`.
2. Present grouped by discipline with minutes and price.
3. Add: `service add NAME --minutes=30 --price=85 [--code=PHY-F --funder=55 --discipline= --kind=initial|followup|other]`. `--code` is the funder's item code, `--funder` what the funder pays (the rest is the patient's surcharge on an ACC visit). A class: add `--class --capacity=6`. Load the codes and amounts from your own fee schedule; the demo's are placeholders. Price changes are a new conversation with the operator, not a silent edit.
