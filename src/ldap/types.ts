export const BASE_DN = "dc=lighthousecph,dc=dk";
export const MEMBER_BASE_DN = `ou=members,${BASE_DN}`;
export const SERVICE_BASE_DN = `ou=services,${BASE_DN}`;
export const LIVE_BIND_DN = `cn=live-reader,${SERVICE_BASE_DN}`;
export const DEMO_BIND_DN = `cn=demo-reader,${SERVICE_BASE_DN}`;

/**
 * A member record prepared for LDAP. Produced by the mapper (src/mapper.ts)
 * from a StripeMemberRecord. All fields are guaranteed non-null and non-empty —
 * any StripeMemberRecord missing displayName or email is filtered out before
 * reaching this type.
 */
export interface LdapMemberRecord {
  /**
   * HMAC-SHA256 hex of the Stripe customerId, keyed by UID_HASH_SEED.
   * Hashing avoids exposing raw Stripe IDs in directory queries while keeping
   * UIDs stable and deterministic across fetches.
   */
  uid: string;

  email: string;

  /** Full display name from Stripe (guaranteed non-empty at this layer). */
  displayName: string;

  /**
   * Surname extracted from displayName (last whitespace-separated word).
   * Required because LDAP's person objectClass mandates an sn attribute.
   */
  surname: string;

  /**
   * "active"   → member has paid recently; Mio should grant access.
   * "inactive" → grace period elapsed; Mio should restrict access.
   */
  employeeType: "active" | "inactive";
}

/** A wire-ready LDAP entry, as consumed by ldapjs res.send(). */
export interface LdapEntry {
  dn: string;
  attributes: {
    objectClass: string[];
    uid: string;
    mail: string;
    cn: string;
    sn: string;
    employeeType: "active" | "inactive";
  };
}
