export const BASE_DN = "dc=lighthousecph,dc=dk";
export const MEMBER_BASE_DN = `ou=members,${BASE_DN}`;
export const SERVICE_BASE_DN = `ou=services,${BASE_DN}`;
export const LIVE_BIND_DN = `cn=live-reader,${SERVICE_BASE_DN}`;
export const DEMO_BIND_DN = `cn=demo-reader,${SERVICE_BASE_DN}`;

export interface LdapEntry {
  dn: string;
  attributes: {
    objectClass: string[];
    uid: string;
    mail: string;
    cn: string;
    sn: string;
    employeeType: "active" | "grace_period";
  };
}
