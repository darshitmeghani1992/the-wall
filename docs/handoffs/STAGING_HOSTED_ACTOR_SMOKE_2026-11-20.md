# Staging hosted actor-bound smoke · 20 November 2026

**QA status:** Verified *backend/SQL smoke*, not independent Reviewer/QA certification or mobile E2E. Original live database remains untouched.

- **Target only:** Supabase staging `ewintxgdxdvschiqodkq`, Postgres 17.
- **Source:** `supabase/tests/hosted_actor_smoke.sql` in this exact source tree.
- **Test authorization:** staging-only synthetic identities and data. Never run on `wfsfafmgvxevpzrurofz` or with real Auth accounts.
- **Execution:** one SQL request transaction with `BEGIN` ... `ROLLBACK` followed by read-only zero-count proof. The synthetic emails have `.invalid` domains; no emails were sent.
- **Observed result:** every PL/pgSQL assertion completed without raising; the final query returned **0** Auth users, profiles, Walls, Marks and Storage objects.

## Contracts exercised against hosted database

1. Inserting three synthetic profiles auto-generated one private Personal Wall per actor.
2. The accepted friend could view the owner's private Wall, create a text Mark using the canonical SECURITY DEFINER `create_mark` RPC, and retry with the same request ID to obtain `existing` without duplication.
3. A stranger could not SELECT the private Wall. The stranger's negative write used the **valid actual Wall UUID pre-captured under the privileged role**, not an RLS-hidden/NULL locator, and returned `unavailable`.
4. Creating a Secret text Mark isolated the payload: `marks.text IS NULL`, with exactly one `mark_secrets` side row.
5. After the owner blocked the previously accepted friend, that friend could not create another Mark via the exact valid Wall UUID.
6. No synthetic records persisted after transaction rollback.

## Inferences explicitly excluded

- Does not prove email OTP, OAuth, session persistence, Auth provider signup, Actual PostgREST with client JWTs, push notifications, or Android/iPhone device behavior.
- Does not independently certify every RLS policy, especially 60 authenticated SECURITY DEFINER advisor warnings; cannot replace adversarial Reviewer/QA testing.
- Does not enable or test Photo/Voice/Video: feature kind controls remain OFF and processor is not hosted.
- Does not exercise 0031 account-deletion worker: that separate irreversible lifecycle remains Founder-gated.

**Next gate:** verify SMTP and six-digit OTP delivery after tomorrow's domain/SMTP setup, then actual three-account Android tests and independent Reviewer→QA on the unchanged source/runtime.
