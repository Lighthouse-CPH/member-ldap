import type { MemberRecord } from "../stripe/types.ts";
import { MEMBER_BASE_DN } from "./types.ts";
import type { LdapEntry } from "./types.ts";

export function memberDn(customerId: string): string {
  return `uid=${customerId},${MEMBER_BASE_DN}`;
}

export function parseSurname(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) return "Member";
  return parts[parts.length - 1];
}

export function memberToLdapEntry(member: MemberRecord): LdapEntry {
  return {
    dn: memberDn(member.customerId),
    attributes: {
      objectClass: ["inetOrgPerson", "organizationalPerson", "person", "top"],
      uid: member.customerId,
      mail: member.email,
      cn: member.displayName,
      sn: member.surname,
      employeeType: member.status,
    },
  };
}

export interface FilterLike {
  matches(attrs: Record<string, unknown>): boolean;
}

/**
 * Filters LDAP entries by scope (base, one, sub) and LDAP filter.
 * reqDn: the base DN of the search request.
 */
type LdapScope = "base" | "one" | "sub" | 0 | 1 | 2;

function normalizeScope(scope: LdapScope): "base" | "one" | "sub" {
  if (scope === 0 || scope === "base") return "base";
  if (scope === 1 || scope === "one") return "one";
  return "sub";
}

export function filterEntries(
  entries: LdapEntry[],
  reqDn: string,
  scope: LdapScope,
  filter: FilterLike,
): LdapEntry[] {
  const normalReqDn = reqDn.toLowerCase();
  const scopeStr = normalizeScope(scope);

  return entries.filter((entry) => {
    const entryDn = entry.dn.toLowerCase();

    // Scope check
    if (scopeStr === "base") {
      if (entryDn !== normalReqDn) return false;
    } else if (scopeStr === "one") {
      // Direct children only: entry DN ends with ",reqDn" and has no more commas in the prefix
      if (!entryDn.endsWith(`,${normalReqDn}`)) return false;
      const prefix = entryDn.slice(0, entryDn.length - normalReqDn.length - 1);
      if (prefix.includes(",")) return false;
    } else if (scopeStr === "sub") {
      // Entry must be equal to or a descendant of reqDn
      if (entryDn !== normalReqDn && !entryDn.endsWith(`,${normalReqDn}`)) {
        return false;
      }
    } else {
      return false;
    }

    // Filter check — ldapjs filter.matches() expects flat attributes object
    const flat: Record<string, unknown> = {
      ...entry.attributes,
      dn: entry.dn,
    };
    try {
      return filter.matches(flat);
    } catch {
      return false;
    }
  });
}
