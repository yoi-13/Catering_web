import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  place,
  mutate,
  paid,
  monthlyReport,
  normalizeState,
  type State,
} from "../lib/domain";
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
  mutate(s, "confirm", {
    id: "order-1",
    paymentId: "confirm-paid",
    amount: 0,
    date: "2026-10-01",
    method: "Cash",
  });
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
test("older bills migrate into grouped supplier and worker profiles", () => {
  const s = setup();
  s.bills.push(
    {
      id: "s1",
      party: "Market",
      kind: "supplier",
      period: "INV-1",
      amount: 5000,
      paid: 0,
      invoiceDate: "2026-10-01",
    },
    {
      id: "s2",
      party: "Market",
      kind: "supplier",
      period: "INV-2",
      amount: 7000,
      paid: 0,
      invoiceDate: "2026-10-02",
    },
    {
      id: "w1",
      party: "Aina",
      kind: "payroll",
      period: "October",
      amount: 150000,
      paid: 150000,
      invoiceDate: "2026-10-01",
    },
  );
  normalizeState(s);
  assert.equal(s.bills.length, 0);
  assert.equal(s.suppliers.length, 1);
  assert.equal(s.suppliers[0].transactions.length, 2);
  assert.equal(s.workers.length, 1);
  assert.equal(s.workers[0].payments.length, 1);
});
test("minimum guests, valid dates, and positive money enforced", () => {
  const s = setup();
  assert.throws(() => place(s, { ...data(), pax: 1 }, "x", "t"));
  assert.throws(() => place(s, { ...data(), date: "2027-02-30" }, "x", "t"));
  assert.throws(() => mutate(s, "entry", entry(-1)));
  assert.throws(() => mutate(s, "entry", entry(1.5)));
});
const confirm = (amount: number) => ({
  id: "order-1",
  paymentId: "confirmation-1",
  amount,
  date: "2026-10-01",
  method: "Bank transfer",
  reference: "TEST",
});
test("confirmation atomically creates one deposit and leaves balance", () => {
  const s = setup();
  mutate(s, "confirm", confirm(5000));
  assert.equal(s.orders[0].status, "Confirmed");
  assert.equal(paid(s, "order-1"), 5000);
  mutate(s, "confirm", confirm(5000));
  assert.equal(s.entries.length, 1);
  assert.equal(s.orders[0].total - paid(s, "order-1"), 17000);
});
test("failed confirmation does not change status or payments", () => {
  const s = setup();
  for (const n of [0, -1, 22001])
    assert.throws(() => mutate(s, "confirm", confirm(n)));
  assert.equal(s.orders[0].status, "Pending");
  assert.equal(s.entries.length, 0);
  assert.throws(() =>
    mutate(s, "status", { id: "order-1", status: "Confirmed" }),
  );
});
test("full confirmation uses only remaining balance", () => {
  const s = setup();
  mutate(s, "entry", entry(5000));
  mutate(s, "confirm", confirm(17000));
  assert.equal(paid(s, "order-1"), 22000);
  assert.equal(s.entries.length, 2);
});
const addSupplier = (s: State) =>
  mutate(s, "add_supplier", {
    id: "supplier-1",
    name: "Fresh Market",
    contact: "0123",
    notes: "Produce",
  });
const addSupplierTransaction = (
  s: State,
  id = "invoice-1",
  reference = "INV-001",
) =>
  mutate(s, "add_supplier_transaction", {
    supplierId: "supplier-1",
    id,
    reference,
    invoiceDate: "2026-10-03",
    dueDate: "2026-10-20",
    amount: 1,
    notes: "",
    lines: [
      { description: "Rice", quantity: 2.5, rate: 1200 },
      { description: "Chicken", quantity: 3, rate: 2000 },
    ],
    tax: 600,
    discount: 100,
  });
test("one supplier groups transactions and computes itemized totals", () => {
  const s = setup();
  addSupplier(s);
  addSupplierTransaction(s);
  addSupplierTransaction(s, "invoice-2", "INV-002");
  assert.equal(s.suppliers.length, 1);
  assert.equal(s.suppliers[0].transactions.length, 2);
  assert.equal(s.suppliers[0].transactions[1].amount, 9500);
  assert.throws(() => addSupplierTransaction(s, "invoice-3", "INV-001"));
});
test("supplier payments post once and deletion removes linked ledger entries", () => {
  const s = setup();
  addSupplier(s);
  addSupplierTransaction(s);
  const payment = {
    supplierId: "supplier-1",
    transactionId: "invoice-1",
    paymentId: "payment-1",
    amount: 4500,
    date: "2026-10-04",
    method: "Cash",
    reference: "CASH-1",
  };
  mutate(s, "pay_supplier_transaction", payment);
  mutate(s, "pay_supplier_transaction", payment);
  assert.equal(s.suppliers[0].transactions[0].paid, 4500);
  assert.equal(
    s.entries.filter((e) => e.supplierTransactionId === "invoice-1").length,
    1,
  );
  mutate(s, "delete_supplier_transaction", {
    supplierId: "supplier-1",
    transactionId: "invoice-1",
    confirmed: true,
  });
  assert.equal(s.suppliers[0].transactions.length, 0);
  assert.equal(
    s.entries.filter((e) => e.supplierTransactionId === "invoice-1").length,
    0,
  );
});
const addWorker = (
  s: State,
  workerType: "permanent" | "part-time" = "permanent",
) =>
  mutate(s, "add_worker", {
    id: "worker-1",
    name: "Aina",
    contact: "",
    workerType,
    basis: workerType === "permanent" ? "monthly" : "hourly",
    defaultRate: workerType === "permanent" ? 300000 : 1500,
    notes: "",
  });
const recordPay = (s: State, id = "pay-1", period = "October 2026") =>
  mutate(s, "record_worker_payment", {
    workerId: "worker-1",
    id,
    period,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-31",
    units: 10,
    overtimeHours: 4,
    overtimeRate: 2000,
    bonus: 10000,
    allowance: 5000,
    advance: 3000,
    deduction: 2000,
    date: "2026-10-31",
    method: "Bank transfer",
    reference: "PAY-1",
    notes: "",
  });
test("permanent worker reuses preset salary and adds payroll adjustments", () => {
  const s = setup();
  addWorker(s);
  recordPay(s);
  assert.equal(s.workers.length, 1);
  assert.equal(s.workers[0].payments[0].units, 1);
  assert.equal(s.workers[0].payments[0].amount, 324000);
  assert.equal(s.entries[0].workerPaymentId, "pay-1");
  assert.throws(() => recordPay(s, "pay-2"));
});
test("part-time worker pay uses saved rate times units", () => {
  const s = setup();
  addWorker(s, "part-time");
  recordPay(s);
  assert.equal(s.workers[0].payments[0].amount, 39000);
});
test("deleting a worker removes their payroll history from the ledger", () => {
  const s = setup();
  addWorker(s);
  recordPay(s);
  mutate(s, "delete_worker", { id: "worker-1", confirmed: true });
  assert.equal(s.workers.length, 0);
  assert.equal(s.entries.filter((e) => e.workerId === "worker-1").length, 0);
});
test("monthly report reconciles orders, supplier costs and payroll", () => {
  const s = setup();
  mutate(s, "confirm", confirm(5000));
  addSupplier(s);
  addSupplierTransaction(s);
  mutate(s, "pay_supplier_transaction", {
    supplierId: "supplier-1",
    transactionId: "invoice-1",
    paymentId: "supplier-pay",
    amount: 4500,
    date: "2026-10-04",
    method: "Cash",
    reference: "",
  });
  addWorker(s);
  recordPay(s);
  s.orders[0].date = "2026-10-15";
  const report = monthlyReport(s, "2026-10");
  assert.equal(report.orders.length, 1);
  assert.equal(report.received, 5000);
  assert.equal(report.supplierPaid, 4500);
  assert.equal(report.payrollPaid, 324000);
  assert.equal(report.netCash, -323500);
});
