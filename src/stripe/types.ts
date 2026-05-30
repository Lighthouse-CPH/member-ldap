/**
 * Membership status as derived from all of a customer's Stripe subscriptions.
 *
 * A customer can hold multiple subscriptions (e.g. different membership tiers).
 * We reduce them to a single status using the following priority order,
 * highest to lowest:
 *
 *   active   – at least one subscription is active and NOT collection-paused.
 *              This means the member is in good standing on at least one product.
 *
 *   past_due – no unpaused-active subscription, but at least one is past_due.
 *              Stripe retries collection automatically; the member is in arrears
 *              but not yet cut off. hasPaidRecently captures the grace window.
 *
 *   paused   – all active subscriptions have pause_collection set (collection
 *              deliberately paused, e.g. a sabbatical). No subscription is past_due.
 *
 *   ended    – the customer exists in Stripe but holds no active or past_due
 *              subscriptions (all have been cancelled / expired).
 */
export type MembershipStatus = "active" | "paused" | "past_due" | "ended";

/**
 * A member record built from Stripe data, aggregated across all of a customer's
 * relevant subscriptions. One record per Stripe customer.
 *
 * Fields intentionally omit derived/LDAP-specific concerns (uid hashing, surname
 * splitting). Those are the responsibility of the mapper layer (src/mapper.ts).
 */
export interface StripeMemberRecord {
  /** Stripe customer ID (cus_xxx). Stable across subscription changes. */
  customerId: string;

  /** Customer email. undefined if not set in Stripe. Falsy → filtered by mapper. */
  email: string | undefined;

  /**
   * Customer display name as stored in Stripe. null if the customer has no name.
   * Falsy → filtered by mapper (we cannot produce a useful LDAP entry without it).
   */
  displayName: string | null;

  /** Aggregate membership status; see MembershipStatus for priority rules. */
  status: MembershipStatus;

  /**
   * Whether the member has paid recently enough to retain access.
   *
   * True  → latest invoice is paid, OR unpaid invoice was issued ≤ 2 weeks ago
   *         (Stripe retry grace period: we give the member benefit of the doubt
   *         while automatic collection is still in progress).
   * False → latest invoice has been unpaid for > 2 weeks, or no invoice exists.
   *
   * The LDAP mapper translates this to employeeType: "active" | "inactive".
   */
  hasPaidRecently: boolean;
}
