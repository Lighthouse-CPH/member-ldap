import { assertEquals } from "@std/assert";
import { subscriptionToMember } from "../../src/stripe/client.ts";
import type Stripe from "stripe";

function makeCustomer(
  overrides: Partial<Stripe.Customer> = {},
): Stripe.Customer {
  return {
    id: "cus_test123",
    object: "customer",
    created: 1700000000,
    livemode: false,
    metadata: {},
    email: "test@example.com",
    name: "Jane Doe",
    deleted: undefined,
    ...overrides,
  } as unknown as Stripe.Customer;
}

function makeSubscription(
  status: Stripe.Subscription.Status,
  customer: Stripe.Customer,
): Stripe.Subscription {
  return {
    id: "sub_test123",
    object: "subscription",
    status,
    customer,
    created: 1700000000,
    current_period_end: 1702000000,
    current_period_start: 1700000000,
    items: { object: "list", data: [], has_more: false, url: "" },
    metadata: {},
    livemode: false,
  } as unknown as Stripe.Subscription;
}

Deno.test("subscriptionToMember - active subscription", () => {
  const customer = makeCustomer();
  const sub = makeSubscription("active", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record?.status, "active");
  assertEquals(record?.customerId, "cus_test123");
  assertEquals(record?.email, "test@example.com");
  assertEquals(record?.displayName, "Jane Doe");
  assertEquals(record?.surname, "Doe");
});

Deno.test("subscriptionToMember - past_due subscription maps to grace_period", () => {
  const customer = makeCustomer();
  const sub = makeSubscription("past_due", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record?.status, "grace_period");
});

Deno.test("subscriptionToMember - canceled subscription returns undefined", () => {
  const customer = makeCustomer();
  const sub = makeSubscription("canceled", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record, undefined);
});

Deno.test("subscriptionToMember - single name falls back surname to 'Member'", () => {
  const customer = makeCustomer({ name: "Madonna" });
  const sub = makeSubscription("active", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record?.surname, "Member");
});

Deno.test("subscriptionToMember - no name falls back to email", () => {
  const customer = makeCustomer({ name: null });
  const sub = makeSubscription("active", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record?.displayName, "test@example.com");
});

Deno.test("subscriptionToMember - no name or email falls back to customer id", () => {
  const customer = makeCustomer({ name: null, email: null });
  const sub = makeSubscription("active", customer);
  const record = subscriptionToMember(sub, customer);
  assertEquals(record?.displayName, "cus_test123");
  assertEquals(record?.email, "");
});
