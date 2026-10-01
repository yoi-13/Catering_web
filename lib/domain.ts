import { z } from "zod";
export type Menu = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  active: boolean;
  emoji: string;
};
export type Order = {
  id: string;
  token: string;
  created: string;
  name: string;
  phone: string;
  address: string;
  date: string;
  time: string;
  pax: number;
  method: string;
  note: string;
  status: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
};
export type Entry = {
  id: string;
  date: string;
  kind: "payment" | "refund" | "expense";
  amount: number;
  orderId: string;
  category: string;
  note: string;
  reference: string;
  billId?: string;
  supplierId?: string;
  supplierTransactionId?: string;
  workerId?: string;
  workerPaymentId?: string;
  receipt?: Attachment;
};
export type Attachment = { path: string; name: string };
export type BillLine = { description: string; quantity: number; rate: number };
export type Payroll = {
  workerType: "permanent" | "part-time";
  basis: "monthly" | "hourly" | "daily" | "event";
  rate: number;
  units: number;
  periodStart: string;
  periodEnd: string;
  overtimeHours: number;
  overtimeRate: number;
  allowance: number;
  deduction: number;
};
export type Bill = {
  id: string;
  party: string;
  kind: "supplier" | "payroll";
  period: string;
  amount: number;
  paid: number;
  invoiceDate?: string;
  dueDate?: string;
  contact?: string;
  notes?: string;
  receipt?: Attachment;
  lines?: BillLine[];
  tax?: number;
  discount?: number;
  payroll?: Payroll;
};
export type SupplierTransaction = {
  id: string;
  reference: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  paid: number;
  notes: string;
  receipt?: Attachment;
  lines: BillLine[];
  tax: number;
  discount: number;
};
export type Supplier = {
  id: string;
  name: string;
  contact: string;
  notes: string;
  transactions: SupplierTransaction[];
};
export type WorkerPayment = {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  baseRate: number;
  units: number;
  overtimeHours: number;
  overtimeRate: number;
  bonus: number;
  allowance: number;
  advance: number;
  deduction: number;
  amount: number;
  date: string;
  method: "Bank transfer" | "QR payment" | "Cash";
  reference: string;
  notes: string;
  receipt?: Attachment;
};
export type Worker = {
  id: string;
  name: string;
  contact: string;
  workerType: "permanent" | "part-time";
  basis: "monthly" | "hourly" | "daily" | "event";
  defaultRate: number;
  notes: string;
  payments: WorkerPayment[];
};
export type Settings = {
  company: string;
  bank: string;
  account: string;
  holder: string;
  qr: string;
  qrFile?: Attachment;
  leadDays: number;
  minPax: number;
  capacity: number;
};
export type State = {
  menus: Menu[];
  orders: Order[];
  entries: Entry[];
  bills: Bill[];
  suppliers: Supplier[];
  workers: Worker[];
  settings: Settings;
  audit: { at: string; action: string }[];
};
export const initial: State = {
  menus: [
    {
      id: "m1",
      name: "Kampung feast",
      description:
        "Fragrant rice, ayam masak merah, seasonal vegetables and sambal. A generous crowd favourite.",
      category: "Packages",
      price: 2200,
      active: true,
      emoji: "🍛",
    },
    {
      id: "m2",
      name: "Grilled chicken bowl",
      description: "Smoky chicken, herbed rice and a crisp garden salad.",
      category: "Mains",
      price: 1800,
      active: true,
      emoji: "🥗",
    },
    {
      id: "m3",
      name: "Garden table",
      description:
        "Colourful vegetables, aromatic rice and a rich coconut curry. Vegetarian.",
      category: "Packages",
      price: 2000,
      active: true,
      emoji: "🥬",
    },
    {
      id: "m4",
      name: "Kuih selection",
      description:
        "A little sweetness for the table. Three assorted pieces per person.",
      category: "Desserts",
      price: 600,
      active: true,
      emoji: "🍰",
    },
    {
      id: "m5",
      name: "Fresh lime cooler",
      description:
        "Fresh lime, a touch of sweetness and plenty of refreshment.",
      category: "Drinks",
      price: 400,
      active: true,
      emoji: "🍋",
    },
    {
      id: "m6",
      name: "Celebration spread",
      description:
        "Rice, two mains, vegetables, dessert and a refreshing drink.",
      category: "Packages",
      price: 3500,
      active: true,
      emoji: "🍱",
    },
  ],
  orders: [],
  entries: [],
  bills: [],
  suppliers: [],
  workers: [],
  settings: {
    company: "Gather Catering",
    bank: "",
    account: "",
    holder: "",
    qr: "",
    leadDays: 2,
    minPax: 10,
    capacity: 500,
  },
  audit: [],
};
const text = z.string().trim().min(1).max(250),
  amount = z.number().int().positive().max(100000000);
export const attachmentSchema = z.object({
  path: z.string().regex(/^(qr|receipts)\/[a-f0-9-]+\.(png|jpg|webp|pdf)$/),
  name: text,
});
const nonnegative = z.number().int().min(0).max(100000000);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      !Number.isNaN(Date.parse(x)) &&
      new Date(x).toISOString().slice(0, 10) === x,
    "Invalid date",
  );
export const checkout = z.object({
  name: text,
  phone: z.string().trim().min(7).max(30),
  address: text,
  date: day,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pax: z.number().int().positive().max(10000),
  method: z.enum(["transfer", "qr", "cash"]),
  note: z.string().max(1000).default(""),
  items: z
    .array(z.object({ id: text, qty: z.number().int().positive().max(10000) }))
    .min(1)
    .max(50),
});
export function today() {
  return new Date().toISOString().slice(0, 10);
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(cents / 100);
}
export function paid(s: State, id: string) {
  return s.entries
    .filter((e) => e.orderId === id)
    .reduce(
      (a, e) =>
        a +
        (e.kind === "payment" ? e.amount : e.kind === "refund" ? -e.amount : 0),
      0,
    );
}
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "record";

export function normalizeState(value: State): State {
  const s = value as State;
  s.bills ??= [];
  s.suppliers ??= [];
  s.workers ??= [];
  s.entries ??= [];
  for (const b of s.bills) {
    if (b.kind === "supplier") {
      let supplier = s.suppliers.find(
        (x) => x.name.toLowerCase() === b.party.toLowerCase(),
      );
      if (!supplier) {
        supplier = {
          id: `supplier-${slug(b.party)}`,
          name: b.party,
          contact: b.contact ?? "",
          notes: "Imported from the earlier bills workspace.",
          transactions: [],
        };
        s.suppliers.push(supplier);
      }
      if (!supplier.transactions.some((x) => x.id === b.id))
        supplier.transactions.push({
          id: b.id,
          reference: b.period,
          invoiceDate: b.invoiceDate ?? today(),
          dueDate: b.dueDate,
          amount: b.amount,
          paid: b.paid,
          notes: b.notes ?? "",
          receipt: b.receipt,
          lines: b.lines ?? [],
          tax: b.tax ?? 0,
          discount: b.discount ?? 0,
        });
      for (const e of s.entries.filter((e) => e.billId === b.id)) {
        e.supplierId = supplier.id;
        e.supplierTransactionId = b.id;
      }
    } else {
      const p = b.payroll;
      let worker = s.workers.find(
        (x) => x.name.toLowerCase() === b.party.toLowerCase(),
      );
      if (!worker) {
        worker = {
          id: `worker-${slug(b.party)}`,
          name: b.party,
          contact: b.contact ?? "",
          workerType: p?.workerType ?? "permanent",
          basis: p?.basis ?? "monthly",
          defaultRate: p?.rate ?? b.amount,
          notes: "Imported from the earlier payroll workspace.",
          payments: [],
        };
        s.workers.push(worker);
      }
      if (!worker.payments.some((x) => x.id === b.id)) {
        const expense = s.entries.find((e) => e.billId === b.id);
        worker.payments.push({
          id: b.id,
          period: b.period,
          periodStart: p?.periodStart ?? b.invoiceDate ?? today(),
          periodEnd: p?.periodEnd ?? b.dueDate ?? b.invoiceDate ?? today(),
          baseRate: p?.rate ?? b.amount,
          units: p?.units ?? 1,
          overtimeHours: p?.overtimeHours ?? 0,
          overtimeRate: p?.overtimeRate ?? 0,
          bonus: 0,
          allowance: p?.allowance ?? 0,
          advance: 0,
          deduction: p?.deduction ?? 0,
          amount: b.amount,
          date: expense?.date ?? b.invoiceDate ?? today(),
          method: "Bank transfer",
          reference: expense?.reference ?? b.id,
          notes: b.notes ?? "",
          receipt: expense?.receipt ?? b.receipt,
        });
        for (const e of s.entries.filter((e) => e.billId === b.id)) {
          e.workerId = worker.id;
          e.workerPaymentId = b.id;
        }
      }
    }
  }
  s.bills = [];
  return s;
}

export function monthlyReport(s: State, month: string) {
  normalizeState(s);
  const orders = s.orders.filter(
    (o) => o.date.startsWith(month) && o.status !== "Cancelled",
  );
  const entries = s.entries.filter((e) => e.date.startsWith(month));
  const supplierTransactions = s.suppliers.flatMap((supplier) =>
    supplier.transactions
      .filter((transaction) => transaction.invoiceDate.startsWith(month))
      .map((transaction) => ({ supplier, transaction })),
  );
  const payroll = s.workers.flatMap((worker) =>
    worker.payments
      .filter((payment) => payment.date.startsWith(month))
      .map((payment) => ({ worker, payment })),
  );
  const received = entries.reduce(
    (sum, e) =>
      sum +
      (e.kind === "payment" ? e.amount : e.kind === "refund" ? -e.amount : 0),
    0,
  );
  const supplierPaid = entries
    .filter((e) => e.kind === "expense" && e.category === "Suppliers")
    .reduce((sum, e) => sum + e.amount, 0);
  const payrollPaid = entries
    .filter((e) => e.kind === "expense" && e.category === "Payroll")
    .reduce((sum, e) => sum + e.amount, 0);
  const otherExpenses = entries
    .filter(
      (e) =>
        e.kind === "expense" &&
        e.category !== "Suppliers" &&
        e.category !== "Payroll",
    )
    .reduce((sum, e) => sum + e.amount, 0);
  const orderValue = orders.reduce((sum, o) => sum + o.total, 0);
  return {
    month,
    orders,
    entries,
    supplierTransactions,
    payroll,
    orderValue,
    received,
    supplierPaid,
    payrollPaid,
    otherExpenses,
    expenses: supplierPaid + payrollPaid + otherExpenses,
    netCash: received - supplierPaid - payrollPaid - otherExpenses,
    outstanding: orders.reduce((sum, o) => sum + o.total - paid(s, o.id), 0),
    guests: orders.reduce((sum, o) => sum + o.pax, 0),
  };
}
export function place(s: State, input: unknown, id: string, token: string) {
  const v = checkout.parse(input);
  const earliest = new Date();
  earliest.setUTCHours(0, 0, 0, 0);
  earliest.setUTCDate(earliest.getUTCDate() + s.settings.leadDays);
  if (new Date(v.date) < earliest)
    throw Error(`Please book at least ${s.settings.leadDays} days ahead.`);
  if (v.pax < s.settings.minPax)
    throw Error(`Minimum ${s.settings.minPax} guests.`);
  if (
    s.orders
      .filter((o) => o.date === v.date && o.status !== "Cancelled")
      .reduce((a, o) => a + o.pax, 0) +
      v.pax >
    s.settings.capacity
  )
    throw Error("This date has reached capacity. Please choose another date.");
  if (new Set(v.items.map((i) => i.id)).size !== v.items.length)
    throw Error("Duplicate menu items.");
  const items = v.items.map((i) => {
    const m = s.menus.find((m) => m.id === i.id && m.active);
    if (!m) throw Error("A selected menu is unavailable.");
    return { name: m.name, price: m.price, qty: i.qty };
  });
  const total = items.reduce((a, i) => a + i.price * i.qty, 0);
  if (!Number.isSafeInteger(total) || total > 100000000)
    throw Error("Order total is too large.");
  const order: Order = {
    ...v,
    id,
    token,
    created: new Date().toISOString(),
    items,
    total,
    status: "Pending",
  };
  s.orders.unshift(order);
  return order;
}
export function mutate(s: State, action: string, data: unknown) {
  normalizeState(s);
  const v = data as Record<string, unknown>;
  if (action === "confirm") {
    const p = z
      .object({
        id: text,
        paymentId: text,
        amount: nonnegative,
        date: day,
        method: z.enum(["Bank transfer", "QR payment", "Cash"]),
        reference: z.string().max(150).default(""),
        receipt: attachmentSchema.optional(),
      })
      .parse(v);
    const o = s.orders.find((o) => o.id === p.id);
    if (!o) throw Error("Order not found.");
    const previous = s.entries.find((e) => e.id === p.paymentId);
    if (previous) {
      if (
        previous.orderId !== o.id ||
        previous.amount !== p.amount ||
        previous.kind !== "payment"
      )
        throw Error("Payment reference already used.");
      return;
    }
    if (o.status !== "Pending")
      throw Error("Only pending orders can be confirmed.");
    const due = o.total - paid(s, o.id);
    if (p.amount > due || (due > 0 && p.amount === 0))
      throw Error(
        "Enter the deposit or full amount actually received, up to the outstanding balance.",
      );
    if (p.amount > 0)
      s.entries.unshift({
        id: p.paymentId,
        date: p.date,
        kind: "payment",
        amount: p.amount,
        orderId: o.id,
        category: p.method,
        reference: p.reference,
        note:
          p.amount === due
            ? "Full balance received on confirmation"
            : "Deposit received on confirmation",
        receipt: p.receipt,
      });
    o.status = "Confirmed";
  } else if (action === "menu") {
    const m = z
      .object({
        id: text,
        name: text,
        description: z.string().max(1000),
        category: z.enum(["Packages", "Mains", "Drinks", "Desserts"]),
        price: amount,
        active: z.boolean(),
        emoji: z.string().max(10),
      })
      .parse(v);
    const i = s.menus.findIndex((x) => x.id === m.id);
    if (i < 0) s.menus.push(m);
    else s.menus[i] = m;
  } else if (action === "status") {
    const { id, status } = z
      .object({
        id: text,
        status: z.enum(["Confirmed", "Preparing", "Completed", "Cancelled"]),
      })
      .parse(v);
    const o = s.orders.find((x) => x.id === id);
    if (!o) throw Error("Order not found.");
    const allowed: Record<string, string[]> = {
      Pending: ["Cancelled"],
      Confirmed: ["Preparing", "Cancelled"],
      Preparing: ["Completed", "Cancelled"],
      Completed: [],
      Cancelled: [],
    };
    if (!allowed[o.status]?.includes(status))
      throw Error("This status change is not allowed.");
    o.status = status;
  } else if (action === "entry") {
    const e = z
      .object({
        id: text,
        date: day,
        kind: z.enum(["payment", "refund", "expense"]),
        amount,
        orderId: z.string().max(100),
        category: text,
        note: z.string().max(1000),
        reference: z.string().max(150),
        receipt: attachmentSchema.optional(),
      })
      .parse(v);
    if (s.entries.some((x) => x.id === e.id)) return;
    if (e.kind !== "expense") {
      const o = s.orders.find((x) => x.id === e.orderId);
      if (!o) throw Error("Choose an order.");
      const balance = paid(s, o.id);
      if (
        e.kind === "payment" &&
        (o.status === "Cancelled" || e.amount > o.total - balance)
      )
        throw Error("Payment exceeds the balance or order is cancelled.");
      if (e.kind === "refund" && e.amount > balance)
        throw Error("Refund exceeds money received.");
    } else e.orderId = "";
    s.entries.unshift(e);
  } else if (action === "add_supplier") {
    const supplier = z
      .object({
        id: text,
        name: text,
        contact: z.string().max(250).default(""),
        notes: z.string().max(1000).default(""),
      })
      .parse(v);
    if (s.suppliers.some((x) => x.id === supplier.id)) return;
    if (
      s.suppliers.some(
        (x) => x.name.toLowerCase() === supplier.name.toLowerCase(),
      )
    )
      throw Error(
        "This supplier already exists. Open its card to add a transaction.",
      );
    s.suppliers.unshift({ ...supplier, transactions: [] });
  } else if (action === "add_supplier_transaction") {
    const transaction = z
      .object({
        supplierId: text,
        id: text,
        reference: text,
        invoiceDate: day,
        dueDate: day.optional(),
        amount,
        notes: z.string().max(1000).default(""),
        receipt: attachmentSchema.optional(),
        lines: z
          .array(
            z.object({
              description: text,
              quantity: z.number().positive().max(10000),
              rate: nonnegative,
            }),
          )
          .max(50)
          .default([]),
        tax: nonnegative.default(0),
        discount: nonnegative.default(0),
      })
      .parse(v);
    const supplier = s.suppliers.find((x) => x.id === transaction.supplierId);
    if (!supplier) throw Error("Supplier not found.");
    if (supplier.transactions.some((x) => x.id === transaction.id)) return;
    if (
      supplier.transactions.some(
        (x) =>
          x.reference.toLowerCase() === transaction.reference.toLowerCase(),
      )
    )
      throw Error(
        "This transaction reference already exists for the supplier.",
      );
    if (transaction.dueDate && transaction.dueDate < transaction.invoiceDate)
      throw Error("Due date must be on or after the invoice date.");
    if (transaction.lines.length)
      transaction.amount =
        transaction.lines.reduce(
          (sum, line) => sum + Math.round(line.quantity * line.rate),
          0,
        ) +
        transaction.tax -
        transaction.discount;
    if (transaction.amount <= 0)
      throw Error("Transaction total must be positive.");
    const { supplierId: _supplierId, ...record } = transaction;
    supplier.transactions.unshift({ ...record, paid: 0 });
  } else if (action === "pay_supplier_transaction") {
    const payment = z
      .object({
        supplierId: text,
        transactionId: text,
        paymentId: text,
        amount,
        date: day,
        method: z.enum(["Bank transfer", "QR payment", "Cash"]),
        reference: z.string().max(150).default(""),
        receipt: attachmentSchema.optional(),
      })
      .parse(v);
    if (s.entries.some((x) => x.id === payment.paymentId)) return;
    const supplier = s.suppliers.find((x) => x.id === payment.supplierId);
    const transaction = supplier?.transactions.find(
      (x) => x.id === payment.transactionId,
    );
    if (!supplier || !transaction)
      throw Error("Supplier transaction not found.");
    if (payment.amount > transaction.amount - transaction.paid)
      throw Error("Payment exceeds the outstanding balance.");
    transaction.paid += payment.amount;
    s.entries.unshift({
      id: payment.paymentId,
      date: payment.date,
      kind: "expense",
      amount: payment.amount,
      orderId: "",
      category: "Suppliers",
      note: `${supplier.name} — ${transaction.reference} · ${payment.method}`,
      reference: payment.reference || transaction.reference,
      supplierId: supplier.id,
      supplierTransactionId: transaction.id,
      receipt: payment.receipt,
    });
  } else if (action === "delete_supplier_transaction") {
    const deletion = z
      .object({
        supplierId: text,
        transactionId: text,
        confirmed: z.literal(true),
      })
      .parse(v);
    const supplier = s.suppliers.find((x) => x.id === deletion.supplierId);
    if (!supplier) throw Error("Supplier not found.");
    supplier.transactions = supplier.transactions.filter(
      (x) => x.id !== deletion.transactionId,
    );
    s.entries = s.entries.filter(
      (e) => e.supplierTransactionId !== deletion.transactionId,
    );
  } else if (action === "delete_supplier") {
    const deletion = z
      .object({ id: text, confirmed: z.literal(true) })
      .parse(v);
    const supplier = s.suppliers.find((x) => x.id === deletion.id);
    if (!supplier) throw Error("Supplier not found.");
    const ids = new Set(supplier.transactions.map((x) => x.id));
    s.entries = s.entries.filter(
      (e) =>
        e.supplierId !== supplier.id && !ids.has(e.supplierTransactionId ?? ""),
    );
    s.suppliers = s.suppliers.filter((x) => x.id !== supplier.id);
  } else if (action === "add_worker") {
    const worker = z
      .object({
        id: text,
        name: text,
        contact: z.string().max(250).default(""),
        workerType: z.enum(["permanent", "part-time"]),
        basis: z.enum(["monthly", "hourly", "daily", "event"]),
        defaultRate: amount,
        notes: z.string().max(1000).default(""),
      })
      .parse(v);
    if (s.workers.some((x) => x.id === worker.id)) return;
    if (
      s.workers.some((x) => x.name.toLowerCase() === worker.name.toLowerCase())
    )
      throw Error(
        "This worker already exists. Open the worker card to record pay.",
      );
    if (worker.workerType === "permanent" && worker.basis !== "monthly")
      throw Error("Permanent workers use a monthly base salary.");
    if (worker.workerType === "part-time" && worker.basis === "monthly")
      throw Error("Part-time workers use hourly, daily or event rates.");
    s.workers.unshift({ ...worker, payments: [] });
  } else if (action === "record_worker_payment") {
    const payment = z
      .object({
        workerId: text,
        id: text,
        period: text,
        periodStart: day,
        periodEnd: day,
        units: z.number().positive().max(10000),
        overtimeHours: z.number().min(0).max(1000),
        overtimeRate: nonnegative,
        bonus: nonnegative,
        allowance: nonnegative,
        advance: nonnegative,
        deduction: nonnegative,
        date: day,
        method: z.enum(["Bank transfer", "QR payment", "Cash"]),
        reference: z.string().max(150).default(""),
        notes: z.string().max(1000).default(""),
        receipt: attachmentSchema.optional(),
      })
      .parse(v);
    const worker = s.workers.find((x) => x.id === payment.workerId);
    if (!worker) throw Error("Worker not found.");
    if (worker.payments.some((x) => x.id === payment.id)) return;
    if (
      worker.payments.some(
        (x) => x.period.toLowerCase() === payment.period.toLowerCase(),
      )
    )
      throw Error(
        "A payroll record already exists for this worker and period.",
      );
    if (payment.periodEnd < payment.periodStart)
      throw Error("Payroll period end must follow its start.");
    const units = worker.workerType === "permanent" ? 1 : payment.units;
    const total =
      Math.round(worker.defaultRate * units) +
      Math.round(payment.overtimeHours * payment.overtimeRate) +
      payment.bonus +
      payment.allowance +
      payment.advance -
      payment.deduction;
    if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000)
      throw Error("Net pay must be positive and within the allowed limit.");
    const { workerId: _workerId, ...details } = payment;
    const record: WorkerPayment = {
      ...details,
      units,
      baseRate: worker.defaultRate,
      amount: total,
    };
    worker.payments.unshift(record);
    s.entries.unshift({
      id: `expense-${record.id}`,
      date: record.date,
      kind: "expense",
      amount: record.amount,
      orderId: "",
      category: "Payroll",
      note: `${worker.name} — ${record.period} · ${record.method}`,
      reference: record.reference || record.period,
      workerId: worker.id,
      workerPaymentId: record.id,
      receipt: record.receipt,
    });
  } else if (action === "delete_worker_payment") {
    const deletion = z
      .object({ workerId: text, paymentId: text, confirmed: z.literal(true) })
      .parse(v);
    const worker = s.workers.find((x) => x.id === deletion.workerId);
    if (!worker) throw Error("Worker not found.");
    worker.payments = worker.payments.filter(
      (x) => x.id !== deletion.paymentId,
    );
    s.entries = s.entries.filter(
      (e) => e.workerPaymentId !== deletion.paymentId,
    );
  } else if (action === "delete_worker") {
    const deletion = z
      .object({ id: text, confirmed: z.literal(true) })
      .parse(v);
    const worker = s.workers.find((x) => x.id === deletion.id);
    if (!worker) throw Error("Worker not found.");
    const ids = new Set(worker.payments.map((x) => x.id));
    s.entries = s.entries.filter(
      (e) => e.workerId !== worker.id && !ids.has(e.workerPaymentId ?? ""),
    );
    s.workers = s.workers.filter((x) => x.id !== worker.id);
  } else if (action === "bill") {
    const b = z
      .object({
        id: text,
        party: text,
        kind: z.enum(["supplier", "payroll"]),
        period: text,
        amount,
        invoiceDate: day.optional(),
        dueDate: day.optional(),
        contact: z.string().max(250).default(""),
        notes: z.string().max(1000).default(""),
        receipt: attachmentSchema.optional(),
        lines: z
          .array(
            z.object({
              description: text,
              quantity: z.number().positive().max(10000),
              rate: nonnegative,
            }),
          )
          .min(1)
          .max(50)
          .optional(),
        tax: nonnegative.default(0),
        discount: nonnegative.default(0),
        payroll: z
          .object({
            workerType: z.enum(["permanent", "part-time"]),
            basis: z.enum(["monthly", "hourly", "daily", "event"]),
            rate: amount,
            units: z.number().positive().max(10000),
            periodStart: day,
            periodEnd: day,
            overtimeHours: z.number().min(0).max(1000),
            overtimeRate: nonnegative,
            allowance: nonnegative,
            deduction: nonnegative,
          })
          .optional(),
      })
      .parse(v);
    if (s.bills.some((x) => x.id === b.id)) return;
    if (b.invoiceDate && b.dueDate && b.dueDate < b.invoiceDate)
      throw Error("Due date must be on or after invoice date.");
    if (b.kind === "supplier" && b.lines)
      b.amount =
        b.lines.reduce((n, l) => n + Math.round(l.quantity * l.rate), 0) +
        b.tax -
        b.discount;
    if (b.kind === "payroll" && b.payroll) {
      const p = b.payroll;
      if (p.periodEnd < p.periodStart)
        throw Error("Payroll period end must follow its start.");
      if (
        p.workerType === "permanent" &&
        (p.basis !== "monthly" || p.units !== 1)
      )
        throw Error("Permanent payroll uses one monthly base salary.");
      if (p.workerType === "part-time" && p.basis === "monthly")
        throw Error("Part-time payroll uses hourly, daily or event rates.");
      b.amount =
        Math.round(p.rate * p.units) +
        Math.round(p.overtimeHours * p.overtimeRate) +
        p.allowance -
        p.deduction;
    }
    if (
      !Number.isSafeInteger(b.amount) ||
      b.amount <= 0 ||
      b.amount > 100000000
    )
      throw Error("Net amount must be positive and within the allowed limit.");
    if (
      s.bills.some(
        (x) =>
          x.kind === b.kind &&
          x.party.toLowerCase() === b.party.toLowerCase() &&
          x.period.toLowerCase() === b.period.toLowerCase(),
      )
    )
      throw Error(
        "A record for this person/supplier and reference already exists.",
      );
    s.bills.unshift({ ...b, paid: 0 });
  } else if (action === "paybill") {
    const p = z
      .object({
        id: text,
        amount,
        paymentId: text,
        date: day,
        method: z
          .enum(["Bank transfer", "QR payment", "Cash"])
          .default("Bank transfer"),
        reference: z.string().max(150).default(""),
        receipt: attachmentSchema.optional(),
      })
      .parse(v);
    if (s.entries.some((x) => x.id === p.paymentId)) return;
    const b = s.bills.find((b) => b.id === p.id);
    if (!b || p.amount > b.amount - b.paid)
      throw Error("Payment exceeds bill balance.");
    b.paid += p.amount;
    s.entries.unshift({
      id: p.paymentId,
      date: p.date,
      amount: p.amount,
      kind: "expense",
      orderId: "",
      category: b.kind === "payroll" ? "Payroll" : "Suppliers",
      note: `${b.party} — ${b.period} · ${p.method}`,
      reference: p.reference || b.id,
      billId: b.id,
      receipt: p.receipt,
    });
  } else if (action === "settings") {
    s.settings = z
      .object({
        company: text,
        bank: z.string().max(100),
        account: z.string().max(100),
        holder: z.string().max(100),
        qr: z
          .string()
          .max(2000)
          .refine(
            (x) => !x || /^https:\/\//.test(x) || x === "/api/files?qr=1",
            "QR image must use an HTTPS URL",
          ),
        qrFile: attachmentSchema
          .refine((x) => x.path.startsWith("qr/"), "Choose a QR image upload.")
          .optional(),
        leadDays: z.number().int().min(0).max(365),
        minPax: z.number().int().min(1).max(10000),
        capacity: z.number().int().min(1).max(100000),
      })
      .parse(v);
  } else throw Error("Unknown action.");
  s.audit.unshift({ at: new Date().toISOString(), action });
  s.audit = s.audit.slice(0, 500);
}
