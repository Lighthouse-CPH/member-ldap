# member-ldap

An LDAPS directory server that exposes the Lighthouse CPH member roster for
real-time eligibility checks.

## What it does

Lighthouse CPH membership is managed via Stripe subscriptions. This server reads
those subscriptions and presents them as an LDAP directory so that external
services can query who is currently an active member — without needing direct
access to Stripe.

Two service accounts are available:

| Account       | DN                                                  | Data                                    |
| ------------- | --------------------------------------------------- | --------------------------------------- |
| `live-reader` | `cn=live-reader,ou=services,dc=lighthousecph,dc=dk` | Live members from Stripe                |
| `demo-reader` | `cn=demo-reader,ou=services,dc=lighthousecph,dc=dk` | 8 fake members for testing integrations |

Members are stored under `ou=members,dc=lighthousecph,dc=dk` as `inetOrgPerson`
entries, identified by their Stripe customer ID (`uid`). The `employeeType`
attribute indicates membership status: `active` or `grace_period` (past-due
subscriptions).

## How it works

```
Stripe API
    │  paginate active + past_due subscriptions
    ▼
In-memory TTL cache (5 min, stale-if-error)
    │
    ▼
LDAP directory (ldapjs, LDAPS on :636)
    │  bind + search only — no writes
    ▼
External service queries members
```

On startup the server opens two listeners:

- **`:636`** — LDAPS (TLS terminated by Fly.io, plain LDAP forwarded to the app)
- **`:8080`** — HTTP health check (`GET /` → `200 OK`)

## Running locally

**Prerequisites**: Deno 2

```bash
# 1. Copy and fill in .env
cp .env.example .env
# Fill in STRIPE_SECRET_KEY, LDAP_BIND_PASSWORD, LDAP_DEMO_PASSWORD in .env

# 2. Start the server
deno task dev

# 3. Health check
curl http://localhost:8080/

# 4. Query live members (requires openldap tools: brew install openldap)
ldapsearch -H ldap://localhost:636 -x \
  -D "cn=live-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "changeme-live-password \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"

# 5. Query demo members
ldapsearch -H ldap://localhost:636 -x \
  -D "cn=demo-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "changeme-demo-password" \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"
```

## Testing the deployed server

macOS's built-in `ldapsearch` cannot connect due to TLS restrictions. Install the
Homebrew version first:

```bash
brew install openldap
```

Then query the deployed server directly:

```bash
# Demo members (no Stripe needed)
$(brew --prefix)/opt/openldap/bin/ldapsearch -H ldaps://ldap.lighthousecph.dk:636 \
  -D "cn=demo-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "your-demo-password" \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"

# Live members
$(brew --prefix)/bin/ldapsearch -H ldaps://ldap.lighthousecph.dk:636 \
  -D "cn=live-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "your-live-password" \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"
```

## Deployment (fly.io)

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  LDAP_BIND_PASSWORD="..." \
  LDAP_DEMO_PASSWORD="..."

fly deploy
```

TLS for port 636 is terminated by Fly.io — the app receives plain LDAP.
Provision the certificate with:

```bash
fly ips allocate-v4
fly ips allocate-v6
fly certs create ldap.lighthousecph.dk
```

Then point `ldap.lighthousecph.dk` A/AAAA records at the allocated IPs. Fly will
auto-provision and renew a Let's Encrypt cert.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture, gotchas, and
conventions.
