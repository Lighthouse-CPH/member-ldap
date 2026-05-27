import ldap from "ldapjs";
import type { MemberSource } from "./handlers.ts";
import { createBindHandler, createSearchHandler } from "./handlers.ts";
import { DEMO_BIND_DN, LIVE_BIND_DN } from "./types.ts";

interface LdapServerOptions {
  livePassword: string;
  demoPassword: string;
  memberSource: MemberSource;
}

export function createLdapServer(
  opts: LdapServerOptions,
): ReturnType<typeof ldap.createServer> {
  // Always use plain TCP — TLS is terminated by the infrastructure layer (Fly.io passthrough).
  const server = ldap.createServer();

  const bindHandler = createBindHandler({
    liveBindDn: LIVE_BIND_DN,
    livePassword: opts.livePassword,
    demoBindDn: DEMO_BIND_DN,
    demoPassword: opts.demoPassword,
  });

  const searchHandler = createSearchHandler(
    opts.memberSource,
    DEMO_BIND_DN,
    LIVE_BIND_DN,
  );

  server.bind(LIVE_BIND_DN, bindHandler);
  server.bind(DEMO_BIND_DN, bindHandler);
  server.search("", searchHandler);

  return server;
}

export function startLdapServer(
  server: ReturnType<typeof ldap.createServer>,
  port: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`[ldap] server listening on port ${port}`);
      resolve();
    });
    server.on("error", reject);
  });
}
