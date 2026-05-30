import { assertEquals } from "@std/assert";
import {
  filterEntries,
  memberDn,
  memberToLdapEntry,
} from "../../src/ldap/directory.ts";
import { MEMBER_BASE_DN } from "../../src/ldap/types.ts";
import type { LdapEntry, LdapMemberRecord } from "../../src/ldap/types.ts";

// Fixtures use pre-hashed UIDs — in production these come from hashCustomerId(),
// but the directory layer is agnostic to how UIDs are produced.
const alice: LdapMemberRecord = {
  uid: "hashed-uid-alice",
  email: "alice@example.dk",
  displayName: "Alice Andersen",
  surname: "Andersen",
  employeeType: "active",
};

const bob: LdapMemberRecord = {
  uid: "hashed-uid-bob",
  email: "bob@example.dk",
  displayName: "Bob",
  surname: "Member",
  employeeType: "inactive",
};

Deno.test("memberDn - formats DN correctly", () => {
  assertEquals(memberDn("hashed-uid-abc"), `uid=hashed-uid-abc,${MEMBER_BASE_DN}`);
});

Deno.test("memberToLdapEntry - active member shape", () => {
  const entry = memberToLdapEntry(alice);
  assertEquals(entry.dn, `uid=hashed-uid-alice,${MEMBER_BASE_DN}`);
  assertEquals(entry.attributes.uid, "hashed-uid-alice");
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

Deno.test("memberToLdapEntry - inactive member has correct employeeType", () => {
  const entry = memberToLdapEntry(bob);
  assertEquals(entry.attributes.employeeType, "inactive");
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
  const aliceDn = memberDn("hashed-uid-alice");
  const results = filterEntries(entries, aliceDn, "base", matchAll);
  assertEquals(results.length, 1);
  assertEquals(results[0].attributes.uid, "hashed-uid-alice");
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
  assertEquals(results[0].attributes.uid, "hashed-uid-alice");
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
