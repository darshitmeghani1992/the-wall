# Product Assumptions Register

## Deferred destination recovery

### DL-A1: One pending destination is sufficient for MVP users
**Confidence:** Believed-likely  
**Introduced:** 2026-09-16, PRD-DL-001  
**What would confirm or break this:** The Master Build Spec requires preservation of an original
destination but does not require a queue; real usage showing multiple concurrent intents would break
the assumption.  
**Status:** Untested; a queue is Verified as not required by current scope  
**If broken:** Consider a later destination inbox only after usage evidence supports its cost.

### DL-A2: A 24-hour retention window balances completion and stale-intent risk
**Confidence:** Believed-likely  
**Introduced:** 2026-09-16, PRD-DL-001  
**What would confirm or break this:** Beta data on time from link-open to completed authentication;
material legitimate resumes after 24 hours would break it.  
**Status:** Untested  
**If broken:** Adjust the expiry through a reviewed product decision; do not silently retain forever.

### DL-A3: Account-state gates must override deferred destinations
**Confidence:** Verified  
**Introduced:** 2026-09-16, PRD-DL-001  
**What would confirm or break this:** Master Build Spec account-lifecycle requirements and the
existing canonical account-route contract confirm it.  
**Status:** Confirmed  
**If broken:** Destination recovery could bypass suspension/deactivation safeguards and must be
disabled immediately.

### DL-A4: The enumerated destination families cover the highest-value MVP recovery journeys
**Confidence:** Believed-likely  
**Introduced:** 2026-09-16, PRD-DL-001  
**What would confirm or break this:** Beta usage of Personal Wall by handle/user ID, Shared Wall,
Shared invite, and privacy-safe Mark focus recovery; frequent unsupported destinations would break
it.  
**Status:** Untested  
**If broken:** Add destination families incrementally through the same allowlist and review process.

### DL-A5: Sign-out should continue when durable destination clearing fails
**Confidence:** Believed-likely  
**Introduced:** 2026-09-16, PRD-DL-001 architecture review correction  
**What would confirm or break this:** Device/simulator fault-injection showing that process quarantine
and scrub retries preserve user control without cross-account restoration. A cross-account result
breaks this assumption and blocks release.  
**Status:** Untested  
**If broken:** Disable durable recovery and retain only the process-memory fallback; do not block
sign-out to preserve the feature.
