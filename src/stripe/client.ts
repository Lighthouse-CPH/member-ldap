import type Stripe from "stripe";
import type { MemberRecord, MembershipStatus } from "./types.ts";
import { createTtlCache } from "./cache.ts";

const CACHE_KEY = "members";
const membersCache = createTtlCache<Map<string, MemberRecord>>();

/**
 * Converts a Stripe subscription + customer to a MemberRecord.
 * Returns undefined if the subscription status is not active or past_due.
 */
export function subscriptionToMember(
  sub: Stripe.Subscription,
  customer: Stripe.Customer,
): MemberRecord | undefined {
  let status: MembershipStatus;
  if (sub.status === "active") {
    status = "active";
  } else if (sub.status === "past_due") {
    status = "grace_period";
  } else {
    return undefined;
  }

  const displayName = customer.name ?? customer.email ?? customer.id;
  const surname = parseSurname(displayName);

  return {
    customerId: customer.id,
    email: customer.email ?? "",
    displayName,
    surname,
    status,
  };
}

function parseSurname(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) return "Member";
  return parts[parts.length - 1];
}

/**
 * Fetches all active and grace_period members from Stripe.
 * Paginate past_due first, then active (active wins on dedup by customer ID).
 * Uses stale cache as fallback on Stripe API errors.
 */
export async function fetchMembers(
  deps: { stripe: Stripe; productId?: string; cacheTtlMs: number },
): Promise<Map<string, MemberRecord>> {
  const cached = membersCache.get(CACHE_KEY);
  if (cached) return cached;

  try {
    const members = new Map<string, MemberRecord>();

    for (const stripeStatus of ["past_due", "active"] as const) {
      const params: Stripe.SubscriptionListParams = {
        status: stripeStatus,
        expand: ["data.customer"],
        limit: 100,
      };
      if (deps.productId) {
        params.price = deps.productId;
      }

      let page = await deps.stripe.subscriptions.list(params);

      while (true) {
        for (const sub of page.data) {
          const customer = sub.customer as Stripe.Customer;
          if (typeof customer === "string") continue; // not expanded
          if (customer.deleted) continue;

          const record = subscriptionToMember(sub, customer);
          if (record) {
            // active overwrites past_due (active wins on dedup)
            members.set(record.customerId, record);
          }
        }

        if (!page.has_more) break;
        page = await deps.stripe.subscriptions.list({
          ...params,
          starting_after: page.data[page.data.length - 1].id,
        });
      }
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
