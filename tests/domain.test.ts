import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, place, mutate, paid, type State } from "../lib/domain";
const data = () => ({
  name: "Test Guest",
  phone: "0123456789",
  address: "Test address",
  date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  time: "12:00",
  pax: 10,
  method: "cash",
  note: "",
  items: [{ id: "m1", qty: 10 }],
});
const setup = () => {
  const s = structuredClone(initial);
  place(s, data(), "order-1", "a".repeat(64));
  return s;
};
const entry = (amount: number, kind = "payment", id = "entry-1") => ({
  id,
  date: "2026-10-01",
  kind,
  amount,
  orderId: "order-1",
  category: "Cash",
  note: "",
  reference: "",
});
test("prices come from catalogue and historical snapshots survive edits", () => {
  const s = setup();
  assert.equal(s.orders[0].total, 22000);
  mutate(s, "menu", { ...s.menus[0], price: 5000, active: false });
  assert.equal(s.orders[0].items[0].price, 2200);
  assert.equal(s.orders[0].total, 22000);
  assert.throws(() => place(s, data(), "other", "token"));
});
test("duplicate item IDs and unavailable dates are rejected", () => {
  const s = structuredClone(initial);
  assert.throws(() =>
    place(
      s,
      {
        ...data(),
        items: [
          { id: "m1", qty: 1 },
          { id: "m1", qty: 2 },
        ],
      },
      "x",
      "t",
    ),
  );
  assert.throws(() => place(s, { ...data(), date: "2020-01-01" }, "x", "t"));
});
test("capacity counts active bookings but excludes cancellation", () => {
  const s = setup();
  s.settings.capacity = 10;
  assert.throws(() => place(s, data(), "o2", "t"));
  mutate(s, "status", { id: "order-1", status: "Cancelled" });
  place(s, data(), "o2", "t");
  assert.equal(s.orders.length, 2);
});
test("payments cannot exceed balance; refunds cannot exceed receipts", () => {
  const s = setup();
  mutate(s, "entry", entry(10000));
  assert.equal(paid(s, "order-1"), 10000);
  assert.throws(() => mutate(s, "entry", entry(13000, "payment", "p2")));
  assert.throws(() => mutate(s, "entry", entry(10001, "refund", "r1")));
  mutate(s, "entry", entry(4000, "refund", "r2"));
  assert.equal(paid(s, "order-1"), 6000);
});
test("duplicate payment IDs do not double count", () => {
  const s = setup();
  mutate(s, "entry", entry(10000));
  mutate(s, "entry", entry(10000));
  assert.equal(paid(s, "order-1"), 10000);
});
test("status transitions never reset payment history", () => {
  const s = setup();
  mutate(s, "entry", entry(22000));
  mutate(s, "status", { id: "order-1", status: "Confirmed" });
  assert.throws(() =>
    mutate(s, "status", { id: "order-1", status: "Confirmed" }),
  );
  mutate(s, "status", { id: "order-1", status: "Preparing" });
  mutate(s, "status", { id: "order-1", status: "Completed" });
  assert.throws(() =>
    mutate(s, "status", { id: "order-1", status: "Confirmed" }),
  );
  assert.equal(paid(s, "order-1"), 22000);
});
test("supplier/payroll payments update ledger once and preserve period", () => {
  const s = setup();
  mutate(s, "bill", {
    id: "b1",
    party: "Demo worker",
    kind: "payroll",
    period: "October 2026",
    amount: 150000,
  });
  const p = { id: "b1", paymentId: "bp1", amount: 50000, date: "2026-10-01" };
  mutate(s, "paybill", p);
  mutate(s, "paybill", p);
  assert.equal(s.bills[0].paid, 50000);
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].kind, "expense");
  assert.throws(() =>
    mutate(s, "paybill", { ...p, paymentId: "bp2", amount: 100001 }),
  );
});
test("minimum guests, valid dates, and positive money enforced", () => {
  const s = setup();
  assert.throws(() => place(s, { ...data(), pax: 1 }, "x", "t"));
  assert.throws(() => place(s, { ...data(), date: "2027-02-30" }, "x", "t"));
  assert.throws(() => mutate(s, "entry", entry(-1)));
  assert.throws(() => mutate(s, "entry", entry(1.5)));
});
