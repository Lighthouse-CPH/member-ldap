# ADR 0002: ldapjs as the LDAP server library

**Status**: Accepted

## Context

We need to speak the LDAP wire protocol. Options considered:

- **ldapjs** (npm) — the only mature, actively maintained LDAP *server* library for
  the Node.js/npm ecosystem. v3 released 2023.
- **Write raw LDAP** — impractical; the protocol is complex and security-sensitive.
- **Use an external LDAP server (OpenLDAP, 389 DS)** — would require a sidecar process,
  a persistent data store, and a sync mechanism from Stripe. Significant operational
  overhead for what is essentially a read-only, stateless view.

## Decision

Use `npm:ldapjs@^3` via Deno's npm compatibility layer.

## Reasons

- Only mature option in the ecosystem for implementing an LDAP *server* (not just client).
- Handles the wire protocol, DN parsing, filter evaluation, and connection lifecycle.
- Read-only use (bind + search) means we are only exposed to a small surface of the API.

## Trade-offs

- ldapjs is a Node.js library with some rough edges under Deno's compat layer.
  Specifically, `tls.Server.listen(port, host, callback)` throws in Deno 2 (see ADR 0003).
- The library's handler model requires calling `next()` after `res.end()` in bind handlers
  for the bound DN to be committed to the connection — this is not documented and was
  discovered empirically. See `AGENTS.md` for details.
- TypeScript types (`@types/ldapjs`) are incomplete; handlers are typed as `any`.
