# Contributing

Contributions from humans and AI agents are welcome and follow the same process.
This file is the single source of truth for how to work on this codebase —
agents should read it too, rather than relying on agent-specific instruction
files.

## Development setup

**Prerequisites**: Deno 2, openssl

```bash
cp .env.example .env
deno task gen-certs >> .env
# Fill in STRIPE_SECRET_KEY, LDAP_BIND_PASSWORD, LDAP_DEMO_PASSWORD
deno task dev
```

## Commands

```bash
deno task test         # unit tests — fast, no network required
deno task test:e2e     # end-to-end tests — spins up a real ldapjs TCP server
deno task lint
deno task fmt
deno task check        # type-check src/main.ts and all imports
deno task gen-certs    # generate self-signed dev cert, outputs to stdout
```

Run `deno task test` before opening a pull request. Run `deno task test:e2e` if
you have touched anything in `src/ldap/`.

## Architecture

```
src/
  config.ts          — env var loading, fails fast on missing secrets
  stripe/
    types.ts         — MemberRecord, MembershipStatus
    cache.ts         — generic TTL cache with stale-if-error via getStale()
    client.ts        — fetchMembers(): paginates Stripe, deduplicates by customer ID
  demo/
    data.ts          — 8 static fake MemberRecords for cn=demo-reader
  ldap/
    types.ts         — DN constants (BASE_DN, MEMBER_BASE_DN, LIVE_BIND_DN, DEMO_BIND_DN)
    directory.ts     — memberToLdapEntry(), filterEntries(), parseSurname()
    handlers.ts      — createBindHandler(), createSearchHandler()
    server.ts        — createLdapServer() wires handlers onto ldapjs with TLS
  http/
    server.ts        — Deno.serve health check on :8080
  main.ts            — entry point, SIGTERM shutdown
```

Stripe fetch order: `past_due` first, then `active`. Active wins on duplicate
customer ID, so a customer with both statuses (edge case) is always shown as
`active`.

## Architectural decisions

Key decisions — including the reasoning and trade-offs — are recorded in
`docs/adr/`. Read these before making changes that touch the areas they cover:

- [ADR 0001](docs/adr/0001-deno-2-runtime.md) — why Deno 2
- [ADR 0002](docs/adr/0002-ldapjs-server-library.md) — why ldapjs, and its
  limitations
- [ADR 0003](docs/adr/0003-stripe-customer-id-as-ldap-uid.md) — why Stripe
  customer ID as uid
- [ADR 0004](docs/adr/0004-app-owned-tls.md) — why app-owned TLS over fly.io
  passthrough

If a change you are making constitutes a new architectural decision, add an ADR.

## Non-obvious implementation details

These are things that are not in any library documentation and were discovered
empirically. They are recorded here so they are not re-discovered the hard way.

**ldapjs: bind handler must call `next()` after `res.end()`**

ldapjs only writes the bound DN onto the connection object after the entire
handler chain completes. Calling `res.end()` without then calling `next()` means
every subsequent request on that connection appears to come from `cn=anonymous`.

```typescript
// correct
res.end();
return next();
```

**ldapjs: `req.scope` is a number, not a string**

In real search requests, `req.scope` is `0` (base), `1` (one), or `2` (sub).
Unit test mocks may use strings; `filterEntries()` in `src/ldap/directory.ts`
normalises both forms.

**ldapjs: error classes come from the import**

```typescript
import ldap from "ldapjs";
return next(new ldap.InvalidCredentialsError());
```

**ldapjs TLS under Deno 2**

`ldapjs.createServer({ certificate, key })` followed by
`server.listen(port, callback)` throws
`TypeError: callback?.call is not a function` in Deno's `node:_tls_wrap`. The
production path (fly.io raw TCP → app TLS) is unaffected. E2E tests use a plain
TCP server and `ldap://` to work around this. See ADR 0004.

## Security constraints

Do not remove or weaken these without a security review:

- No write handlers are registered on the LDAP server (bind + search + unbind
  only).
- Password comparison uses `timingSafeEqual` from `node:crypto`.
- Logs must never include email, display name, or other PII — only customer IDs
  and counts.
- `loadConfig()` throws on startup if any required secret is missing.
- TLS certificates are passed via environment variables and never written to
  disk.

## Commit conventions

This repository uses
[Conventional Commits](https://www.conventionalcommits.org/):
`type(optional scope): description`. Common types: `feat`, `fix`, `chore`,
`refactor`, `docs`, `test`.
