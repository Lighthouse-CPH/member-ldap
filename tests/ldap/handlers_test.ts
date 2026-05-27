import { assertEquals, assertInstanceOf } from "@std/assert";
import ldap from "ldapjs";
import {
  createBindHandler,
  createSearchHandler,
} from "../../src/ldap/handlers.ts";
import type { MemberSource } from "../../src/ldap/handlers.ts";
import type { MemberRecord } from "../../src/stripe/types.ts";
import {
  DEMO_BIND_DN,
  LIVE_BIND_DN,
  MEMBER_BASE_DN,
} from "../../src/ldap/types.ts";

// Minimal mock request / response builder
function makeBind(dn: string, password: string) {
  const req: Record<string, unknown> = {
    dn: { toString: () => dn },
    credentials: password,
  };
  const res = {
    ended: false,
    end() {
      this.ended = true;
    },
  };
  let nextError: Error | undefined;
  const next = (err?: Error) => {
    nextError = err;
  };
  return {
    req,
    res,
    next: next as (err?: Error) => void,
    getNextError: () => nextError,
  };
}

function makeSearch(boundDn: string | undefined, reqDn: string) {
  const req: Record<string, unknown> = {
    dn: { toString: () => reqDn },
    scope: "sub",
    filter: { matches: () => true },
    connection: boundDn
      ? { ldap: { bindDN: { toString: () => boundDn } } }
      : undefined,
  };
  const sent: unknown[] = [];
  const res = {
    ended: false,
    send(entry: unknown) {
      sent.push(entry);
    },
    end() {
      this.ended = true;
    },
  };
  let nextError: Error | undefined;
  const next = (err?: Error) => {
    nextError = err;
  };
  return {
    req,
    res,
    next: next as (err?: Error) => void,
    sent,
    getNextError: () => nextError,
  };
}

const livePassword = "live-secret";
const demoPassword = "demo-secret";

const bindHandler = createBindHandler({
  liveBindDn: LIVE_BIND_DN,
  livePassword,
  demoBindDn: DEMO_BIND_DN,
  demoPassword,
});

Deno.test("bindHandler - accepts correct live credentials", () => {
  const { req, res, next } = makeBind(LIVE_BIND_DN, livePassword);
  bindHandler(req, res, next);
  assertEquals(res.ended, true);
});

Deno.test("bindHandler - accepts correct demo credentials", () => {
  const { req, res, next } = makeBind(DEMO_BIND_DN, demoPassword);
  bindHandler(req, res, next);
  assertEquals(res.ended, true);
});

Deno.test("bindHandler - rejects wrong password", () => {
  const { req, res, next, getNextError } = makeBind(LIVE_BIND_DN, "wrong");
  bindHandler(req, res, next);
  assertEquals(res.ended, false);
  assertInstanceOf(getNextError(), ldap.InvalidCredentialsError);
});

Deno.test("bindHandler - rejects unknown DN", () => {
  const { req, res, next, getNextError } = makeBind(
    "cn=unknown,dc=example,dc=com",
    livePassword,
  );
  bindHandler(req, res, next);
  assertEquals(res.ended, false);
  assertInstanceOf(getNextError(), ldap.InvalidCredentialsError);
});

const liveMembers: Map<string, MemberRecord> = new Map([
  ["cus_live1", {
    customerId: "cus_live1",
    email: "live@example.dk",
    displayName: "Live Person",
    surname: "Person",
    status: "active",
  }],
]);

const liveSource: MemberSource = {
  getMembers: () => Promise.resolve(liveMembers),
};

const searchHandler = createSearchHandler(
  liveSource,
  DEMO_BIND_DN,
  LIVE_BIND_DN,
);

Deno.test("searchHandler - unauthenticated returns InsufficientAccessRights", async () => {
  const { req, res, next, getNextError } = makeSearch(
    undefined,
    MEMBER_BASE_DN,
  );
  await searchHandler(req, res, next);
  assertInstanceOf(getNextError(), ldap.InsufficientAccessRightsError);
});

Deno.test("searchHandler - live-reader returns live members", async () => {
  const { req, res, sent } = makeSearch(LIVE_BIND_DN, MEMBER_BASE_DN);
  await searchHandler(req, res, () => {});
  assertEquals(sent.length, 1);
  assertEquals(
    (sent[0] as { attributes: { uid: string } }).attributes.uid,
    "cus_live1",
  );
});

Deno.test("searchHandler - demo-reader returns demo members", async () => {
  const { req, res, sent } = makeSearch(DEMO_BIND_DN, MEMBER_BASE_DN);
  await searchHandler(req, res, () => {});
  assertEquals(sent.length, 8); // DEMO_MEMBERS has 8 entries
});
