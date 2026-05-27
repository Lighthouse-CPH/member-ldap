export type MembershipStatus = "active" | "grace_period";

export interface MemberRecord {
  customerId: string; // Stripe cus_xxx — stable UID
  email: string;
  displayName: string;
  surname: string; // parsed from displayName, fallback "Member"
  status: MembershipStatus;
}
