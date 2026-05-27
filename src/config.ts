export interface Config {
  stripeSecretKey: string;
  stripeProductId?: string;
  cacheTtlMs: number;
  ldapBindPassword: string;
  ldapDemoPassword: string;
  ldapPort: number;
  httpPort: number;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return Deno.env.get(name) || undefined;
}

function intEnv(name: string, defaultValue: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

export function loadConfig(): Config {
  return {
    stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
    stripeProductId: optionalEnv("STRIPE_PRODUCT_ID"),
    cacheTtlMs: intEnv("CACHE_TTL_MS", 300_000),
    ldapBindPassword: requireEnv("LDAP_BIND_PASSWORD"),
    ldapDemoPassword: requireEnv("LDAP_DEMO_PASSWORD"),
    ldapPort: intEnv("LDAP_PORT", 636),
    httpPort: intEnv("HTTP_PORT", 8080),
  };
}
