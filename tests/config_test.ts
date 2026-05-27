import { assertEquals, assertThrows } from "@std/assert";
import { loadConfig } from "../src/config.ts";

function withEnv(vars: Record<string, string>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = Deno.env.get(k);
    Deno.env.set(k, v);
  }
  try {
    fn();
  } finally {
    for (const [k, orig] of Object.entries(saved)) {
      if (orig === undefined) {
        Deno.env.delete(k);
      } else {
        Deno.env.set(k, orig);
      }
    }
  }
}

const baseEnv = {
  STRIPE_SECRET_KEY: "sk_test_xxx",
  LDAP_BIND_PASSWORD: "live-secret",
  LDAP_DEMO_PASSWORD: "demo-secret",
};

Deno.test("loadConfig - loads all required fields", () => {
  withEnv(baseEnv, () => {
    const config = loadConfig();
    assertEquals(config.stripeSecretKey, "sk_test_xxx");
    assertEquals(config.ldapBindPassword, "live-secret");
    assertEquals(config.ldapDemoPassword, "demo-secret");
    assertEquals(config.cacheTtlMs, 300_000);
    assertEquals(config.ldapPort, 636);
    assertEquals(config.httpPort, 8080);
    assertEquals(config.stripeProductId, undefined);
  });
});

Deno.test("loadConfig - uses optional STRIPE_PRODUCT_ID when set", () => {
  withEnv({ ...baseEnv, STRIPE_PRODUCT_ID: "prod_abc" }, () => {
    const config = loadConfig();
    assertEquals(config.stripeProductId, "prod_abc");
  });
});

Deno.test("loadConfig - applies numeric overrides", () => {
  withEnv({
    ...baseEnv,
    CACHE_TTL_MS: "60000",
    LDAP_PORT: "1389",
    HTTP_PORT: "9090",
  }, () => {
    const config = loadConfig();
    assertEquals(config.cacheTtlMs, 60_000);
    assertEquals(config.ldapPort, 1389);
    assertEquals(config.httpPort, 9090);
  });
});

for (const key of Object.keys(baseEnv)) {
  Deno.test(`loadConfig - throws when ${key} is missing`, () => {
    const envWithout = { ...baseEnv } as Record<string, string>;
    delete envWithout[key];
    // Clear the key in env
    const saved = Deno.env.get(key);
    Deno.env.delete(key);
    try {
      withEnv(envWithout, () => {
        assertThrows(() => loadConfig(), Error, key);
      });
    } finally {
      if (saved !== undefined) Deno.env.set(key, saved);
    }
  });
}

Deno.test("loadConfig - throws on non-integer CACHE_TTL_MS", () => {
  withEnv({ ...baseEnv, CACHE_TTL_MS: "not-a-number" }, () => {
    assertThrows(() => loadConfig(), Error, "CACHE_TTL_MS");
  });
});
