import { assertEquals } from "@std/assert";
import { computeHasPaidRecently, computeSubStatus } from "../../src/stripe/client.ts";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// computeSubStatus
// ---------------------------------------------------------------------------

function makeSub(
  status: Stripe.Subscription.Status,
  pauseCollection: Stripe.Subscription["pause_collection"] = null,
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    status,
    pause_collection: pauseCollection,
  } as unknown as Stripe.Subscription;
}

Deno.test("computeSubStatus - active subscription (no pause)", () => {
  assertEquals(computeSubStatus(makeSub("active")), "active");
});

Deno.test("computeSubStatus - active subscription with pause_collection is paused", () => {
  // Stripe keeps status="active" when collection is paused; we surface it as "paused".
  const paused = makeSub("active", {
    behavior: "keep_as_draft",
    resumes_at: null,
  });
  assertEquals(computeSubStatus(paused), "paused");
});

Deno.test("computeSubStatus - past_due subscription", () => {
  assertEquals(computeSubStatus(makeSub("past_due")), "past_due");
});

// ---------------------------------------------------------------------------
// computeHasPaidRecently
// ---------------------------------------------------------------------------

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

function makeInvoice(
  status: Stripe.Invoice.Status,
  createdMs: number,
  now: number,
): Stripe.Invoice {
  // `created` is a Unix timestamp in seconds
  return {
    status,
    created: Math.floor((now - createdMs) / 1000),
  } as unknown as Stripe.Invoice;
}

Deno.test("computeHasPaidRecently - paid invoice → true", () => {
  const now = Date.now();
  const invoice = makeInvoice("paid", THREE_WEEKS_MS, now); // old but paid
  assertEquals(computeHasPaidRecently(invoice, now), true);
});

Deno.test("computeHasPaidRecently - unpaid invoice within 2 weeks → true (grace period)", () => {
  const now = Date.now();
  const invoice = makeInvoice("open", ONE_WEEK_MS, now); // 1 week old, unpaid
  assertEquals(computeHasPaidRecently(invoice, now), true);
});

Deno.test("computeHasPaidRecently - unpaid invoice older than 2 weeks → false", () => {
  const now = Date.now();
  const invoice = makeInvoice("open", THREE_WEEKS_MS, now); // 3 weeks old, unpaid
  assertEquals(computeHasPaidRecently(invoice, now), false);
});

Deno.test("computeHasPaidRecently - null invoice → false (no payment data)", () => {
  assertEquals(computeHasPaidRecently(null), false);
});

Deno.test("computeHasPaidRecently - string invoice ID (not expanded) → false", () => {
  // Should not happen in practice, but defensively handled.
  assertEquals(computeHasPaidRecently("in_notexpanded"), false);
});
