---
description: Close out a visit - mark it completed, bill it by its funding (ACC contribution plus a separate surcharge invoice, DVA with no gap, Medicare, insurer, or the patient), make the claim ready, then write the treatment note while it is fresh. Refuses if the case has no informed consent recorded.
---

1. Run `node scripts/clinic.mjs complete REF --json`.
2. If it refuses for consent, that is Right 7 doing its job: `case consent CASE-1 --on=`, then complete again.
3. Say what was invoiced, to whom, for how much (`invoices`), and which claim is now ready (`claim`). The claim lodges once the note is final.
4. Then the note, same breath: ask the practitioner for the SOAP lines (or take them from the operator's words), run `note add REF --s= --o= --a= --p=`, then `note final REF`. A visit is not done until its note is final.
5. If the patient did not rebook, say so: the rebooking rate is made or lost at this moment.
