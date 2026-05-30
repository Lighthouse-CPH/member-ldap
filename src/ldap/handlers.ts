// deno-lint-ignore-file no-explicit-any
import { timingSafeEqual } from "node:crypto";
import ldap from "ldapjs";
import type { LdapMemberRecord } from "./types.ts";
import { filterEntries, memberToLdapEntry } from "./directory.ts";

/**
 * Abstraction over the member data source. The handler does not care whether
 * records came from Stripe or from demo fixtures — both paths produce the same
 * LdapMemberRecord shape after passing through the mapper.
 */
export interface MemberSource {
  getMembers(): Promise<Map<string, LdapMemberRecord>>;
}

interface BindCredentials {
  liveBindDn: string;
  livePassword: string;
  demoBindDn: string;
  demoPassword: string;
}

/**
 * Timing-safe string comparison that avoids early-exit on length mismatch.
 * Without this, an attacker could enumerate valid DN lengths via response timing.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) {
    // Compare against a dummy buffer of the same length to avoid timing leak
    const dummy = new Uint8Array(bufA.length);
    timingSafeEqual(bufA, dummy);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Creates the LDAP bind handler.
 * Accepts live-reader and demo-reader service accounts only.
 * Uses timing-safe password comparison.
 *
 * IMPORTANT: must call next() after res.end() so ldapjs commits the bindDN
 * on the connection. Without next(), subsequent requests see cn=anonymous.
 */
export function createBindHandler(creds: BindCredentials): any {
  return (req: any, res: any, next: any) => {
    const dn = req.dn.toString();
    const password: string = req.credentials ?? "";

    let valid = false;
    if (dn === creds.liveBindDn) {
      valid = timingSafeStringEqual(password, creds.livePassword);
    } else if (dn === creds.demoBindDn) {
      valid = timingSafeStringEqual(password, creds.demoPassword);
    }

    if (valid) {
      res.end();
      // Must call next() so ldapjs commits bindDN on the connection
      return next();
    } else {
      return next(new ldap.InvalidCredentialsError());
    }
  };
}

/**
 * Creates the LDAP search handler.
 *
 * Two separate MemberSources allow the handler to serve different data sets
 * depending on which service account is bound — without embedding any mapping
 * or filtering logic here. Both sources already return LdapMemberRecord maps,
 * so the handler only needs to convert them to wire entries and filter by scope.
 *
 * - demo-reader → demoSource (fake members; no Stripe call)
 * - live-reader → liveSource (real members from Stripe, pre-mapped)
 * - unauthenticated / unknown DN → InsufficientAccessRightsError
 */
export function createSearchHandler(
  liveSource: MemberSource,
  demoSource: MemberSource,
  demoBindDn: string,
  liveBindDn?: string,
): any {
  return async (req: any, res: any, next: any) => {
    const boundDn: string = req.connection?.ldap?.bindDN?.toString() ?? "";

    // Reject anonymous (default DN is "cn=anonymous") and any unknown DNs.
    const isDemo = boundDn === demoBindDn;
    const isLive = liveBindDn
      ? boundDn === liveBindDn
      : (!isDemo && boundDn !== "cn=anonymous" && boundDn !== "");
    if (!isDemo && !isLive) {
      return next(new ldap.InsufficientAccessRightsError());
    }

    try {
      const members = await (isDemo ? demoSource : liveSource).getMembers();

      const entries = Array.from(members.values()).map(memberToLdapEntry);
      const reqDn = req.dn.toString();
      const scope = req.scope ?? "sub";
      const filter = req.filter;

      const matching = filterEntries(entries, reqDn, scope, filter);
      console.log(
        `[ldap] search dn="${reqDn}" scope=${scope} filter="${filter}" bound="${boundDn}" → ${matching.length} result(s)`,
      );

      for (const entry of matching) {
        res.send(entry);
      }
      res.end();
    } catch (err) {
      console.error(
        "[ldap] search error:",
        err instanceof Error ? err.message : err,
      );
      return next(new ldap.OperationsError());
    }
  };
}
