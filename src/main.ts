import Stripe from "stripe";
import { loadConfig } from "./config.ts";
import { fetchMembers } from "./stripe/client.ts";
import { stripeMemberToLdap } from "./mapper.ts";
import { DEMO_MEMBERS } from "./demo/data.ts";
import type { LdapMemberRecord } from "./ldap/types.ts";
import { createLdapServer, startLdapServer } from "./ldap/server.ts";
import { startHttpServer } from "./http/server.ts";

async function main() {
  const config = loadConfig();

  const stripe = new Stripe(config.stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
  });

  const toMap = (records: (LdapMemberRecord | undefined)[]) => {
    const map = new Map<string, LdapMemberRecord>();
    for (const r of records) {
      if (r) map.set(r.uid, r);
    }
    return map;
  };

  const liveMemberSource = {
    getMembers: async () => {
      const stripeMembers = await fetchMembers({
        stripe,
        productId: config.stripeProductId,
        cacheTtlMs: config.cacheTtlMs,
      });
      return toMap(
        Array.from(stripeMembers.values()).map((m) =>
          stripeMemberToLdap(m, config.uidHashSeed)
        ),
      );
    },
  };

  const demoMemberSource = {
    getMembers: () =>
      Promise.resolve(
        toMap(DEMO_MEMBERS.map((m) => stripeMemberToLdap(m, config.uidHashSeed))),
      ),
  };

  const ldapServer = createLdapServer({
    livePassword: config.ldapBindPassword,
    demoPassword: config.ldapDemoPassword,
    liveMemberSource,
    demoMemberSource,
  });

  const httpServer = startHttpServer(config.httpPort);
  await startLdapServer(ldapServer, config.ldapPort);

  // Graceful shutdown on SIGTERM (fly.io sends this before killing the process)
  Deno.addSignalListener("SIGTERM", () => {
    console.log("[main] SIGTERM received, shutting down...");
    ldapServer.close(() => {});
    httpServer.shutdown();
  });

  console.log("[main] Lighthouse CPH LDAP server is running.");
}

main().catch((err) => {
  console.error("[main] Fatal startup error:", err);
  Deno.exit(1);
});
