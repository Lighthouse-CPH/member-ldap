# member-ldap

An LDAPS directory server that exposes the Lighthouse CPH member roster for real-time eligibility checks.

## What it does

Lighthouse CPH membership is managed via Stripe subscriptions. This server reads those subscriptions and presents them as an LDAP directory so that external services can query who is currently an active member — without needing direct access to Stripe.

Two service accounts are available:

| Account | DN | Data |
|---|---|---|
| `live-reader` | `cn=live-reader,ou=services,dc=lighthousecph,dc=dk` | Live members from Stripe |
| `demo-reader` | `cn=demo-reader,ou=services,dc=lighthousecph,dc=dk` | 8 fake members for testing integrations |

Members are stored under `ou=members,dc=lighthousecph,dc=dk` as `inetOrgPerson` entries, identified by their Stripe customer ID (`uid`). The `employeeType` attribute indicates membership status: `active` or `grace_period` (past-due subscriptions).

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
- **`:636`** — LDAPS (TLS owned by the app, raw TCP passthrough from the load balancer)
- **`:8080`** — HTTP health check (`GET /` → `200 OK`)

## Running locally

**Prerequisites**: Deno 2, openssl

```bash
# 1. Generate a self-signed dev cert and append to .env
cp .env.example .env
deno task gen-certs >> .env
# Fill in STRIPE_SECRET_KEY, LDAP_BIND_PASSWORD, LDAP_DEMO_PASSWORD in .env

# 2. Start the server
deno task dev

# 3. Health check
curl http://localhost:8080/

# 4. Query live members (requires openldap tools: brew install openldap)
ldapsearch -H ldaps://localhost:636 -x \
  -D "cn=live-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "$LDAP_BIND_PASSWORD" \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"

# 5. Query demo members
ldapsearch -H ldaps://localhost:636 -x \
  -D "cn=demo-reader,ou=services,dc=lighthousecph,dc=dk" \
  -w "$LDAP_DEMO_PASSWORD" \
  -b "ou=members,dc=lighthousecph,dc=dk" \
  "(objectClass=inetOrgPerson)"
```

## Deployment (fly.io)

```bash
fly secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  LDAP_BIND_PASSWORD="..." \
  LDAP_DEMO_PASSWORD="..." \
  TLS_CERT_PEM="$(cat fullchain.pem)" \
  TLS_KEY_PEM="$(cat privkey.pem)"

fly deploy
```

Port 636 is configured as raw TCP passthrough — the app handles TLS directly so the certificate in your secrets is what clients see.

**TLS certificate**: Use a Let's Encrypt cert via `certbot certonly --manual --preferred-challenges dns -d ldap.lighthousecph.dk`. Renew every 90 days (recommend a 60-day cron).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, architecture, gotchas, and conventions.
