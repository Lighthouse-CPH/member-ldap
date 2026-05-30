import type { StripeMemberRecord } from "../stripe/types.ts";

/**
 * Fake member records for the demo bind account.
 *
 * These mirror the shape of real StripeMemberRecord data so that the demo path
 * exercises the same mapper logic as the live path — including the hasPaidRecently
 * flag, which controls whether a member surfaces as employeeType=active or inactive.
 *
 * Mix: 5 active (hasPaidRecently=true), 3 past_due past the grace period (inactive).
 */
export const DEMO_MEMBERS: StripeMemberRecord[] = [
  {
    customerId: "cus_demo001",
    email: "alice.andersen@example.dk",
    displayName: "Alice Andersen",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_demo002",
    email: "bjorn.nielsen@example.dk",
    displayName: "Bjørn Nielsen",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_demo003",
    email: "camille.christensen@example.dk",
    displayName: "Camille Christensen",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_demo004",
    email: "diana.larsen@example.dk",
    displayName: "Diana Larsen",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_demo005",
    email: "erik.pedersen@example.dk",
    displayName: "Erik Pedersen",
    status: "active",
    hasPaidRecently: true,
  },
  {
    customerId: "cus_demo006",
    email: "freja.sorensen@example.dk",
    displayName: "Freja Sørensen",
    status: "past_due",
    hasPaidRecently: false,
  },
  {
    customerId: "cus_demo007",
    email: "gustav.jensen@example.dk",
    displayName: "Gustav Jensen",
    status: "past_due",
    hasPaidRecently: false,
  },
  {
    customerId: "cus_demo008",
    email: "hana.mogensen@example.dk",
    displayName: "Hana Mogensen",
    status: "past_due",
    hasPaidRecently: false,
  },
];
