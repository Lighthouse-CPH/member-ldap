// deno-lint-ignore-file no-explicit-any
import { timingSafeEqual } from "node:crypto";
import ldap from "ldapjs";
import type { MemberRecord } from "../stripe/types.ts";
import { memberToLdapEntry, filterEntries } from "./directory.ts";
import { DEMO_MEMBERS } from "../demo/data.ts";

export interface MemberSource {
  getMembers(): Promise<Map<string, MemberRecord>>;
}

interface BindCredentials {
  liveBindDn: string;
  livePassword: string;
  demoBindDn: string;
  demoPassword: string;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) {
    // Compare against a dummy buffer of same length to avoid timing leak
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
 * - demo-reader: returns fake DEMO_MEMBERS (no Stripe call)
 * - live-reader: fetches live members from Stripe via MemberSource
 * - unauthenticated: returns InsufficientAccessRightsError
 */
export function createSearchHandler(
  source: MemberSource,
  demoBindDn: string,
  liveBindDn?: string,
): any {
  return async (req: any, res: any, next: any) => {
    const boundDn: string = req.connection?.ldap?.bindDN?.toString() ?? "";

    // Reject anonymous (default DN is "cn=anonymous") and any unknown DNs
    const isDemo = boundDn === demoBindDn;
    const isLive = liveBindDn ? boundDn === liveBindDn : (!isDemo && boundDn !== "cn=anonymous" && boundDn !== "");
    if (!isDemo && !isLive) {
      return next(new ldap.InsufficientAccessRightsError());
    }

    try {
      let members: Map<string, MemberRecord>;

      if (isDemo) {
        members = new Map(DEMO_MEMBERS.map((m) => [m.customerId, m]));
      } else {
        members = await source.getMembers();
      }

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
      console.error("[ldap] search error:", err instanceof Error ? err.message : err);
      return next(new ldap.OperationsError());
    }
  };
}
