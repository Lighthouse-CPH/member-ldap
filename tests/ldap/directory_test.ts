import { assertEquals, assertNotEquals } from "@std/assert";
import {
  filterEntries,
  memberDn,
  memberToLdapEntry,
  parseSurname,
} from "../../src/ldap/directory.ts";
import { MEMBER_BASE_DN } from "../../src/ldap/types.ts";
import type { MemberRecord } from "../../src/stripe/types.ts";
import type { LdapEntry } from "../../src/ldap/types.ts";

const alice: MemberRecord = {
  customerId: "cus_alice",
  email: "alice@example.dk",
  displayName: "Alice Andersen",
  surname: "Andersen",
  status: "active",
};

const bob: MemberRecord = {
  customerId: "cus_bob",
  email: "bob@example.dk",
  displayName: "Bob",
  surname: "Member",
  status: "grace_period",
};

Deno.test("memberDn - formats DN correctly", () => {
  assertEquals(memberDn("cus_abc"), `uid=cus_abc,${MEMBER_BASE_DN}`);
});

Deno.test("parseSurname - extracts last word from multi-word name", () => {
  assertEquals(parseSurname("Alice Andersen"), "Andersen");
  assertEquals(parseSurname("Alice Marie Andersen"), "Andersen");
});

Deno.test("parseSurname - single name returns 'Member'", () => {
  assertEquals(parseSurname("Madonna"), "Member");
});

Deno.test("parseSurname - empty string returns 'Member'", () => {
  assertEquals(parseSurname(""), "Member");
});

Deno.test("memberToLdapEntry - active member shape", () => {
  const entry = memberToLdapEntry(alice);
  assertEquals(entry.dn, `uid=cus_alice,${MEMBER_BASE_DN}`);
  assertEquals(entry.attributes.uid, "cus_alice");
  assertEquals(entry.attributes.mail, "alice@example.dk");
  assertEquals(entry.attributes.cn, "Alice Andersen");
  assertEquals(entry.attributes.sn, "Andersen");
  assertEquals(entry.attributes.employeeType, "active");
  assertEquals(entry.attributes.objectClass, [
    "inetOrgPerson",
    "organizationalPerson",
    "person",
    "top",
  ]);
});

Deno.test("memberToLdapEntry - grace_period member has correct employeeType", () => {
  const entry = memberToLdapEntry(bob);
  assertEquals(entry.attributes.employeeType, "grace_period");
});

// Helper: simple always-match filter
const matchAll = { matches: () => true };
const matchNone = { matches: () => false };
function matchAttr(attr: string, value: string) {
  return {
    matches: (a: Record<string, unknown>) => a[attr] === value,
  };
}

Deno.test("filterEntries - sub scope matches all descendants", () => {
  const entries: LdapEntry[] = [alice, bob].map(memberToLdapEntry);
  const results = filterEntries(entries, MEMBER_BASE_DN, "sub", matchAll);
  assertEquals(results.length, 2);
});

Deno.test("filterEntries - one scope matches direct children", () => {
  const entries: LdapEntry[] = [alice, bob].map(memberToLdapEntry);
  const results = filterEntries(entries, MEMBER_BASE_DN, "one", matchAll);
  assertEquals(results.length, 2);
});

Deno.test("filterEntries - base scope matches only the exact DN", () => {
  const entries: LdapEntry[] = [alice, bob].map(memberToLdapEntry);
  const aliceDn = memberDn("cus_alice");
  const results = filterEntries(entries, aliceDn, "base", matchAll);
  assertEquals(results.length, 1);
  assertEquals(results[0].attributes.uid, "cus_alice");
});

Deno.test("filterEntries - filter by employeeType=active", () => {
  const entries: LdapEntry[] = [alice, bob].map(memberToLdapEntry);
  const results = filterEntries(
    entries,
    MEMBER_BASE_DN,
    "sub",
    matchAttr("employeeType", "active"),
  );
  assertEquals(results.length, 1);
  assertEquals(results[0].attributes.uid, "cus_alice");
});

Deno.test("filterEntries - matchNone returns empty array", () => {
  const entries: LdapEntry[] = [alice, bob].map(memberToLdapEntry);
  const results = filterEntries(entries, MEMBER_BASE_DN, "sub", matchNone);
  assertEquals(results.length, 0);
});

Deno.test("filterEntries - wrong base DN returns no results", () => {
  const entries: LdapEntry[] = [alice].map(memberToLdapEntry);
  const results = filterEntries(entries, "dc=other,dc=org", "sub", matchAll);
  assertEquals(results.length, 0);
});
