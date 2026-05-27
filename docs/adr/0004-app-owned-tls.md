# ADR 0004: App-owned TLS over raw TCP passthrough

**Status**: Accepted

## Context

The server must speak LDAPS (LDAP over TLS) on port 636. On fly.io, services can
be exposed either with TLS termination at the edge (fly handles the cert) or as raw
TCP passthrough (the app handles TLS end-to-end).

For LDAPS specifically, TLS termination at the load balancer would mean the connection
between fly's edge and the app container is plain LDAP — acceptable within a private
network, but it means fly would need to hold the certificate, and the LDAP client would
need to trust fly's edge certificate rather than ours.

## Decision

Configure fly.io with `handlers = []` (raw TCP passthrough) on port 636. The app
loads the TLS certificate and key from environment variables and passes them directly
to ldapjs's `createServer({ certificate, key })`.

## Reasons

- **End-to-end TLS**: the certificate the client sees is the one we control, with our
  domain (`ldap.lighthousecph.dk`). No intermediate termination.
- **Certificate flexibility**: we can rotate the cert via `fly secrets set` without
  any fly infrastructure changes.
- **No cert stored on disk**: PEM strings live only in environment variables (fly
  secrets), never in the container filesystem or the image.

## Trade-offs

- ldapjs's `tls.Server.listen(port, host, callback)` does not work correctly under
  Deno 2's Node compat layer — the callback form triggers
  `TypeError: callback?.call is not a function` in `node:_tls_wrap`. This only affects
  programmatic listen calls in tests; the production path (fly TCP passthrough → app
  TLS) is unaffected. E2E tests use a plain TCP server and `ldap://` to work around this.
- TLS certificate renewal (every 90 days for Let's Encrypt) requires a manual
  `fly secrets set` step. A 60-day cron job is recommended.
