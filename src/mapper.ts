import { createHmac } from "node:crypto";
import type { StripeMemberRecord } from "./stripe/types.ts";
import type { LdapMemberRecord } from "./ldap/types.ts";

export function hashCustomerId(customerId: string, seed: string): string {
  return createHmac("sha256", seed).update(customerId).digest("hex");
}

// Naive surname extraction: takes the last word of displayName.
// This is required because LDAP's person objectClass mandates a surname (sn) attribute,
// and we have no separate surname field from Stripe.
function parseSurname(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) return "Member";
  return parts[parts.length - 1];
}

export function stripeMemberToLdap(
  record: StripeMemberRecord,
  uidHashSeed: string,
): LdapMemberRecord | undefined {
  if (!record.displayName || !record.email) return undefined;
  return {
    uid: hashCustomerId(record.customerId, uidHashSeed),
    email: record.email,
    displayName: record.displayName,
    surname: parseSurname(record.displayName),
    employeeType: record.hasPaidRecently ? "active" : "inactive",
  };
}
