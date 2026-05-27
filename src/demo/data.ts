import type { MemberRecord } from "../stripe/types.ts";

/** 8 fake member records for the demo bind account. Mix of active and grace_period. */
export const DEMO_MEMBERS: MemberRecord[] = [
  {
    customerId: "cus_demo001",
    email: "alice.andersen@example.dk",
    displayName: "Alice Andersen",
    surname: "Andersen",
    status: "active",
  },
  {
    customerId: "cus_demo002",
    email: "bjorn.nielsen@example.dk",
    displayName: "Bjørn Nielsen",
    surname: "Nielsen",
    status: "active",
  },
  {
    customerId: "cus_demo003",
    email: "camille.christensen@example.dk",
    displayName: "Camille Christensen",
    surname: "Christensen",
    status: "active",
  },
  {
    customerId: "cus_demo004",
    email: "diana.larsen@example.dk",
    displayName: "Diana Larsen",
    surname: "Larsen",
    status: "active",
  },
  {
    customerId: "cus_demo005",
    email: "erik.pedersen@example.dk",
    displayName: "Erik Pedersen",
    surname: "Pedersen",
    status: "active",
  },
  {
    customerId: "cus_demo006",
    email: "freja.sorensen@example.dk",
    displayName: "Freja Sørensen",
    surname: "Sørensen",
    status: "grace_period",
  },
  {
    customerId: "cus_demo007",
    email: "gustav.jensen@example.dk",
    displayName: "Gustav Jensen",
    surname: "Jensen",
    status: "grace_period",
  },
  {
    customerId: "cus_demo008",
    email: "hana.mogensen@example.dk",
    displayName: "Hana Mogensen",
    surname: "Mogensen",
    status: "grace_period",
  },
];
