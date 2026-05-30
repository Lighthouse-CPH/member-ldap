/**
 * End-to-end LDAP tests.
 * Uses a plain (non-TLS) ldapjs server for testing — TLS is an infrastructure
 * concern tested at deployment. The handler/directory/bind logic is what matters here.
 * Run with: deno task test:e2e
 */
import { assertEquals } from "@std/assert";
import { Client } from "ldapts";
import ldap from "ldapjs";
import {
  createBindHandler,
  createSearchHandler,
} from "../../src/ldap/handlers.ts";
import type { MemberSource } from "../../src/ldap/handlers.ts";
import type { LdapMemberRecord } from "../../src/ldap/types.ts";
import {
  DEMO_BIND_DN,
  LIVE_BIND_DN,
  MEMBER_BASE_DN,
} from "../../src/ldap/types.ts";
import { DEMO_MEMBERS } from "../../src/demo/data.ts";
import { hashCustomerId, stripeMemberToLdap } from "../../src/mapper.ts";

const TEST_PORT = 13389; // Plain LDAP test port
const LIVE_PASSWORD = "test-live-secret";
const DEMO_PASSWORD = "test-demo-secret";
const TEST_UID_HASH_SEED = "test-e2e-seed";

function buildSource(
  stripeRecords: Parameters<typeof stripeMemberToLdap>[0][],
): MemberSource {
  return {
    getMembers: () => {
      const mapped = new Map<string, LdapMemberRecord>();
      for (const record of stripeRecords) {
        const ldapRecord = stripeMemberToLdap(record, TEST_UID_HASH_SEED);
        if (ldapRecord) mapped.set(ldapRecord.uid, ldapRecord);
      }
      return Promise.resolve(mapped);
    },
  };
}

const liveMemberSource = buildSource([
  {
    customerId: "cus_e2e001",
    email: "e2e@example.dk",
    displayName: "E2E Testperson",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_e2e002",
    email: "grace@example.dk",
    displayName: "Grace Period",
    status: "past_due",
    hasPaidRecently: false,
  },
]);

const demoMemberSource = buildSource(DEMO_MEMBERS);

/** Creates a plain (non-TLS) ldapjs server wired with real handlers. */
function createTestServer() {
  // deno-lint-ignore no-explicit-any
  const server: any = ldap.createServer();

  const bindHandler = createBindHandler({
    liveBindDn: LIVE_BIND_DN,
    livePassword: LIVE_PASSWORD,
    demoBindDn: DEMO_BIND_DN,
    demoPassword: DEMO_PASSWORD,
  });

  const searchHandler = createSearchHandler(
    liveMemberSource,
    demoMemberSource,
    DEMO_BIND_DN,
    LIVE_BIND_DN,
  );

  server.bind(LIVE_BIND_DN, bindHandler);
  server.bind(DEMO_BIND_DN, bindHandler);
  server.search("", searchHandler);

  return server;
}

function startServer(
  // deno-lint-ignore no-explicit-any
  server: any,
  port: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, resolve);
  });
}

// deno-lint-ignore no-explicit-any
let testServer: any;

Deno.test({
  name: "e2e setup",
  async fn() {
    testServer = createTestServer();
    await startServer(testServer, TEST_PORT);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

function makeClient() {
  return new Client({
    url: `ldap://localhost:${TEST_PORT}`,
    timeout: 5000,
    connectTimeout: 5000,
  });
}

Deno.test({
  name: "e2e - live-reader bind succeeds",
  async fn() {
    const client = makeClient();
    await client.bind(LIVE_BIND_DN, LIVE_PASSWORD);
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - demo-reader bind succeeds",
  async fn() {
    const client = makeClient();
    await client.bind(DEMO_BIND_DN, DEMO_PASSWORD);
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - wrong password bind fails",
  async fn() {
    const client = makeClient();
    let threw = false;
    try {
      await client.bind(LIVE_BIND_DN, "wrong-password");
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
    // No unbind needed — bind failed
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - live-reader search returns live members",
  async fn() {
    const client = makeClient();
    await client.bind(LIVE_BIND_DN, LIVE_PASSWORD);
    const { searchEntries } = await client.search(MEMBER_BASE_DN, {
      filter: "(objectClass=inetOrgPerson)",
      scope: "sub",
    });
    assertEquals(searchEntries.length, 2);
    const uids = searchEntries.map((e) => e.uid as string).sort();
    const expectedUids = [
      hashCustomerId("cus_e2e001", TEST_UID_HASH_SEED),
      hashCustomerId("cus_e2e002", TEST_UID_HASH_SEED),
    ].sort();
    assertEquals(uids, expectedUids);
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - live-reader filter by employeeType=active",
  async fn() {
    const client = makeClient();
    await client.bind(LIVE_BIND_DN, LIVE_PASSWORD);
    const { searchEntries } = await client.search(MEMBER_BASE_DN, {
      filter: "(&(objectClass=inetOrgPerson)(employeeType=active))",
      scope: "sub",
    });
    assertEquals(searchEntries.length, 1);
    assertEquals(
      searchEntries[0].uid as string,
      hashCustomerId("cus_e2e001", TEST_UID_HASH_SEED),
    );
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - live-reader filter for active OR inactive",
  async fn() {
    const client = makeClient();
    await client.bind(LIVE_BIND_DN, LIVE_PASSWORD);
    const { searchEntries } = await client.search(MEMBER_BASE_DN, {
      filter:
        "(&(objectClass=inetOrgPerson)(|(employeeType=active)(employeeType=inactive)))",
      scope: "sub",
    });
    assertEquals(searchEntries.length, 2);
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - demo-reader search returns 8 fake members",
  async fn() {
    const client = makeClient();
    await client.bind(DEMO_BIND_DN, DEMO_PASSWORD);
    const { searchEntries } = await client.search(MEMBER_BASE_DN, {
      filter: "(objectClass=inetOrgPerson)",
      scope: "sub",
    });
    assertEquals(searchEntries.length, 8);
    await client.unbind();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e - unauthenticated search is rejected",
  async fn() {
    const client = makeClient();
    // No bind — anonymous
    let threw = false;
    try {
      await client.search(MEMBER_BASE_DN, {
        filter: "(objectClass=inetOrgPerson)",
      });
    } catch {
      threw = true;
    }
    assertEquals(threw, true);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "e2e teardown",
  fn() {
    testServer?.close(() => {});
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
