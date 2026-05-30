import { assertEquals, assertNotEquals } from "@std/assert";
import {
  hashCustomerId,
  stripeMemberToLdap,
} from "../../src/mapper.ts";
import type { StripeMemberRecord } from "../../src/stripe/types.ts";

const TEST_SEED = "test-seed";

Deno.test("hashCustomerId - returns 64-char hex string", () => {
  const hash = hashCustomerId("cus_test123", TEST_SEED);
  assertEquals(hash.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(hash), true);
});

Deno.test("hashCustomerId - deterministic for same input and seed", () => {
  const a = hashCustomerId("cus_test123", TEST_SEED);
  const b = hashCustomerId("cus_test123", TEST_SEED);
  assertEquals(a, b);
});

Deno.test("hashCustomerId - different seeds produce different hashes", () => {
  const a = hashCustomerId("cus_test123", "seed-a");
  const b = hashCustomerId("cus_test123", "seed-b");
  assertNotEquals(a, b);
});

Deno.test("hashCustomerId - different customerIds produce different hashes", () => {
  const a = hashCustomerId("cus_abc", TEST_SEED);
  const b = hashCustomerId("cus_xyz", TEST_SEED);
  assertNotEquals(a, b);
});

const activeMember: StripeMemberRecord = {
  customerId: "cus_test001",
  email: "alice@example.dk",
  displayName: "Alice Andersen",
  status: "active",
  hasPaidRecently: true,
};

Deno.test("stripeMemberToLdap - active paid member maps correctly", () => {
  const result = stripeMemberToLdap(activeMember, TEST_SEED);
  assertEquals(result?.uid, hashCustomerId("cus_test001", TEST_SEED));
  assertEquals(result?.email, "alice@example.dk");
  assertEquals(result?.displayName, "Alice Andersen");
  assertEquals(result?.surname, "Andersen");
  assertEquals(result?.employeeType, "active");
});

Deno.test("stripeMemberToLdap - hasPaidRecently=false gives employeeType inactive", () => {
  const result = stripeMemberToLdap(
    { ...activeMember, hasPaidRecently: false },
    TEST_SEED,
  );
  assertEquals(result?.employeeType, "inactive");
});

Deno.test("stripeMemberToLdap - null displayName returns undefined", () => {
  const result = stripeMemberToLdap(
    { ...activeMember, displayName: null },
    TEST_SEED,
  );
  assertEquals(result, undefined);
});

Deno.test("stripeMemberToLdap - undefined email returns undefined", () => {
  const result = stripeMemberToLdap(
    { ...activeMember, email: undefined },
    TEST_SEED,
  );
  assertEquals(result, undefined);
});

Deno.test("stripeMemberToLdap - single-word displayName falls back surname to 'Member'", () => {
  const result = stripeMemberToLdap(
    { ...activeMember, displayName: "Madonna" },
    TEST_SEED,
  );
  assertEquals(result?.surname, "Member");
});

Deno.test("stripeMemberToLdap - multi-word displayName extracts last word as surname", () => {
  const result = stripeMemberToLdap(
    { ...activeMember, displayName: "Alice Marie Andersen" },
    TEST_SEED,
  );
  assertEquals(result?.surname, "Andersen");
});
