# ADR 0003: Stripe customer ID as the stable member identifier

**Status**: Accepted

## Context

LDAP entries need a stable, unique identifier (`uid`) that:

1. Does not change when a member updates their name or email.
2. Is meaningful enough to trace back to a record if something goes wrong.
3. Does not expose PII in directory queries or server logs.

Candidates considered:

- **Email address** — changes when members update their email; exposes PII.
- **Stripe subscription ID** — changes on renewal or plan change; not stable.
- **Stripe customer ID (`cus_xxx`)** — stable for the lifetime of the customer
  relationship; opaque to third parties; survives email/name changes.
- **Internal UUID** — would require maintaining our own identity store.

## Decision

Use the Stripe customer ID (`cus_xxx`) as the LDAP `uid` and as the RDN in the
member DN: `uid=cus_xxx,ou=members,dc=lighthousecph,dc=dk`.

## Reasons

- **Stable**: survives subscription renewals, plan changes, email updates.
- **Non-PII**: the ID is opaque and meaningless outside our Stripe account.
- **No extra store**: no database or mapping table needed — Stripe is the source
  of truth and the ID is the key.
- **Traceable**: easy to look up the full customer record in the Stripe dashboard
  when investigating an issue.

## Trade-offs

- If a member's Stripe customer record is merged or replaced (rare Stripe edge case),
  their LDAP identity changes. This is acceptable given the rarity and the fact that
  the consuming service performs daily reconciliation.
