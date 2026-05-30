import type Stripe from "stripe";
import type { MembershipStatus, StripeMemberRecord } from "./types.ts";
import { createTtlCache } from "./cache.ts";

const CACHE_KEY = "members";
const membersCache = createTtlCache<Map<string, StripeMemberRecord>>();

/**
 * Two-week grace period for unpaid invoices.
 *
 * When Stripe fails to collect payment, the subscription moves to "past_due" and
 * Stripe automatically retries over several days. We give members the benefit of
 * the doubt for two weeks from the date the invoice was issued — enough time for
 * the retry schedule to complete and for the member to update their payment method.
 * After that window, hasPaidRecently flips to false and the LDAP mapper marks them
 * as employeeType=inactive.
 */
const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Determines whether a subscription's latest invoice was paid (or is still within
 * the grace period).
 *
 * - Paid invoice → true (member is up to date).
 * - Unpaid invoice issued ≤ 2 weeks ago → true (within Stripe's retry window).
 * - Unpaid invoice older than 2 weeks → false (grace period elapsed).
 * - No invoice or invoice not expanded → false (can't confirm payment).
 *
 * The `now` parameter is injectable for deterministic testing.
 */
export function computeHasPaidRecently(
  invoice: Stripe.Invoice | null | string,
  now = Date.now(),
): boolean {
  // If the invoice wasn't expanded from a string ID, we have no data to work with.
  if (!invoice || typeof invoice === "string") return false;

  // A "paid" invoice means collection succeeded. Member is in good standing.
  if (invoice.status === "paid") return true;

  // Invoice is open, uncollectible, or void. Check whether it was issued recently
  // enough for the member to still be within the two-week grace window.
  // invoice.created is a Unix timestamp (seconds); convert to ms for comparison.
  const invoiceAgeMs = now - invoice.created * 1000;
  return invoiceAgeMs <= GRACE_PERIOD_MS;
}

/**
 * Maps a single Stripe subscription to a logical status.
 *
 * Note: Stripe does not have a first-class "paused" subscription status. Instead,
 * subscriptions remain "active" but have a non-null pause_collection object when
 * the merchant has deliberately paused collection (e.g. a member on sabbatical).
 * We surface this distinction as "paused" so that downstream logic can treat it
 * differently from a truly active subscription.
 */
export function computeSubStatus(
  sub: Stripe.Subscription,
): "active" | "paused" | "past_due" {
  if (sub.status === "past_due") return "past_due";
  // Active but with collection paused — still an active subscription technically,
  // but the member is not currently being billed.
  if (sub.status === "active" && sub.pause_collection) return "paused";
  return "active";
}

/**
 * Reduces a list of per-subscription statuses to a single MembershipStatus
 * for the customer, using the priority: active > past_due > paused > ended.
 *
 * "ended" is the fallback when no subscriptions in any other state exist for
 * this customer (shouldn't occur with our current active/past_due fetch, but
 * is included for type completeness).
 */
function aggregateStatus(
  statuses: Array<"active" | "paused" | "past_due">,
): MembershipStatus {
  if (statuses.includes("active")) return "active";
  if (statuses.includes("past_due")) return "past_due";
  if (statuses.includes("paused")) return "paused";
  return "ended";
}

/**
 * Fetches all active and past_due members from Stripe, aggregated by customer.
 *
 * We fetch both subscription states in one pass (past_due first, then active) so
 * that a customer with subscriptions in multiple states is captured correctly.
 * After collecting all subscriptions, we group them by customer and reduce each
 * group to a single StripeMemberRecord.
 *
 * The latest_invoice is expanded inline to avoid N+1 fetches — Stripe supports
 * expanding nested objects in list calls via the `expand` parameter.
 *
 * Uses a TTL cache backed by stale-if-error: if Stripe is unavailable, the last
 * known good result is returned and an error is logged.
 */
export async function fetchMembers(deps: {
  stripe: Stripe;
  productId?: string;
  cacheTtlMs: number;
}): Promise<Map<string, StripeMemberRecord>> {
  const cached = membersCache.get(CACHE_KEY);
  if (cached) return cached;

  try {
    // Intermediate aggregation: collect all subscription data per customer before
    // building the final record. A customer may appear in both the "active" and
    // "past_due" pages if they hold multiple subscriptions.
    const aggregation = new Map<string, {
      customer: Stripe.Customer;
      subStatuses: Array<"active" | "paused" | "past_due">;
      anyPaidRecently: boolean;
    }>();

    for (const stripeStatus of ["past_due", "active"] as const) {
      const params: Stripe.SubscriptionListParams = {
        status: stripeStatus,
        // Expand both the customer object and the latest invoice inline so we
        // avoid a second round-trip per subscription to check payment state.
        expand: ["data.customer", "data.latest_invoice"],
        limit: 100,
      };
      if (deps.productId) {
        params.price = deps.productId;
      }

      let page = await deps.stripe.subscriptions.list(params);

      while (true) {
        for (const sub of page.data) {
          const customer = sub.customer as Stripe.Customer;
          if (typeof customer === "string") continue; // not expanded, skip
          if (customer.deleted) continue;

          const subStatus = computeSubStatus(sub);
          const invoice = sub.latest_invoice as Stripe.Invoice | null | string;
          const paidRecently = computeHasPaidRecently(invoice);

          const existing = aggregation.get(customer.id);
          if (existing) {
            existing.subStatuses.push(subStatus);
            // A single paid-recently subscription is sufficient for the customer
            // to be considered in good standing.
            existing.anyPaidRecently = existing.anyPaidRecently || paidRecently;
          } else {
            aggregation.set(customer.id, {
              customer,
              subStatuses: [subStatus],
              anyPaidRecently: paidRecently,
            });
          }
        }

        if (!page.has_more) break;
        page = await deps.stripe.subscriptions.list({
          ...params,
          starting_after: page.data[page.data.length - 1].id,
        });
      }
    }

    // Build one StripeMemberRecord per customer from the aggregated data.
    const members = new Map<string, StripeMemberRecord>();
    for (const [customerId, { customer, subStatuses, anyPaidRecently }] of aggregation) {
      members.set(customerId, {
        customerId,
        // Keep displayName and email as-is from Stripe; the mapper will filter
        // out records where either is falsy.
        displayName: customer.name ?? null,
        email: customer.email ?? undefined,
        status: aggregateStatus(subStatuses),
        hasPaidRecently: anyPaidRecently,
      });
    }

    membersCache.set(CACHE_KEY, members, deps.cacheTtlMs);
    return members;
  } catch (err) {
    const stale = membersCache.getStale(CACHE_KEY);
    if (stale) {
      console.error(
        `[stripe] API error, returning stale cache (${stale.size} members):`,
        err instanceof Error ? err.message : err,
      );
      return stale;
    }
    throw err;
  }
}
