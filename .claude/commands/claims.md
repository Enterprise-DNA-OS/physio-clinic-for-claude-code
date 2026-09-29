---
description: Every claim to ACC, Medicare, DVA or an insurer from ready to paid - what is ready to lodge, what a missing note is holding back, what the funder has had too long, and what came back rejected.
---

1. Run `node scripts/clinic.mjs claims --json` (add `--funder=acc|medicare|dva|insurer` if the ask names one).
2. Present it in four groups, money first in each: ready to lodge, blocked (name the note that is missing and whose it is), lodged and waiting (days since lodged), rejected (the funder's reason word for word).
3. The one action per group: `claim lodge --ready` for the ready ones; `note add` then `note final` for the blocked; a remittance check for the long-lodged; fix the cause then `claim lodge CLM-...` for the rejected.
4. Never lodge on the operator's behalf without a yes in this session. Lodging here records that the claim went through the funder's own channel; it does not send anything.
