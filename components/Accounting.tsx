"use client";
import { useState, type FormEvent } from "react";
import {
  type Attachment,
  type State,
  type Order,
  type Payroll,
  type BillLine,
  money,
  paid,
  today,
} from "@/lib/domain";
export function ReceiptLink({ file }: { file?: Attachment }) {
  return file ? (
    <a
      className="receipt-link"
      href={"/api/files?path=" + encodeURIComponent(file.path)}
      target="_blank"
      rel="noopener noreferrer"
    >
      📎 {file.name}
    </a>
  ) : null;
}
export function Upload({
  kind,
  value,
  onChange,
  connected,
  onPending,
}: {
  kind: "qr" | "receipts";
  value?: Attachment;
  onChange: (x: Attachment | undefined) => void;
  connected: boolean;
  onPending?: (x: boolean) => void;
}) {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="upload-box">
      <label>
        {kind === "qr"
          ? "Upload merchant QR image"
          : "Attach receipt / invoice"}
        <input
          type="file"
          disabled={!connected || loading}
          accept={
            kind === "qr"
              ? "image/png,image/jpeg,image/webp"
              : "image/png,image/jpeg,image/webp,application/pdf"
          }
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            setLoading(true);
            onPending?.(true);
            try {
              if (file.size > 3 * 1024 * 1024)
                throw Error("Maximum file size is 3 MB.");
              const data = new FormData();
              data.append("file", file);
              data.append("kind", kind);
              const r = await fetch("/api/files", {
                method: "POST",
                body: data,
              });
              const result = await r.json();
              if (!r.ok) throw Error(result.error);
              onChange(result);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Upload failed.");
            } finally {
              setLoading(false);
              onPending?.(false);
            }
          }}
        />
      </label>
      <small className="muted">
        {loading
          ? "Uploading…"
          : connected
            ? "PNG, JPEG, WebP" +
              (kind === "receipts" ? " or PDF" : "") +
              " · Maximum 3 MB"
            : "File uploads are available in the connected workspace."}
      </small>
      {value && (
        <div className="row top-space">
          <ReceiptLink file={value} />
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(undefined)}
          >
            Remove attachment
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}
const fields = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
};
const cents = (value: string) => Math.round(Number(value || 0) * 100);
function Input({
  name,
  label,
  type = "text",
  value,
  required = true,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={step}
        min={min}
      />
    </label>
  );
}
function Method() {
  return (
    <label>
      Payment method
      <select name="method">
        <option>Bank transfer</option>
        <option>QR payment</option>
        <option>Cash</option>
      </select>
    </label>
  );
}
export function ConfirmPayment({
  order,
  state,
  connected,
  busy,
  submit,
  cancel,
}: {
  order: Order;
  state: State;
  connected: boolean;
  busy: boolean;
  submit: (data: unknown) => void;
  cancel: () => void;
}) {
  const due = order.total - paid(state, order.id);
  const [mode, setMode] = useState("full"),
    [receipt, setReceipt] = useState<Attachment>(),
    [uploading, setUploading] = useState(false),
    [paymentId] = useState(() => crypto.randomUUID());
  return (
    <div className="modal-shade">
      <section
        className="panel payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h2 id="confirm-title">Confirm order & payment</h2>
        <p>
          {order.name} · Order {order.id.slice(0, 8).toUpperCase()}
        </p>
        <div className="balance-box">
          <span>Total {money(order.total)}</span>
          <span>Already received {money(paid(state, order.id))}</span>
          <b>Outstanding {money(due)}</b>
        </div>
        <form
          onSubmit={(e) => {
            const f = fields(e);
            submit({
              id: order.id,
              paymentId,
              amount: due === 0 ? 0 : mode === "full" ? due : cents(f.amount),
              date: f.date,
              method: f.method,
              reference: f.reference,
              receipt,
            });
          }}
        >
          {due > 0 ? (
            <>
              <label>
                Amount received
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="full">
                    Full outstanding balance — {money(due)}
                  </option>
                  <option value="deposit">Deposit / partial payment</option>
                </select>
              </label>
              {mode === "deposit" && (
                <Input
                  label="Deposit received (RM)"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                />
              )}
            </>
          ) : (
            <p>
              Fully paid already. Confirmation will not add another transaction.
            </p>
          )}
          <div className="two-col">
            <Input
              label="Payment date"
              name="date"
              type="date"
              value={today()}
            />
            <Method />
          </div>
          <Input
            label="Bank / payment reference"
            name="reference"
            required={false}
          />
          <Upload
            kind="receipts"
            value={receipt}
            onChange={setReceipt}
            onPending={setUploading}
            connected={connected}
          />
          <p className="muted small">
            Confirm only after receiving the money. This saves the payment to
            transaction history and confirms the order together.
          </p>
          <div className="row">
            <button className="primary" disabled={busy || uploading}>
              Confirm & record payment
            </button>
            <button className="secondary" type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function Accounts({
  kind,
  state,
  connected,
  busy,
  change,
  run,
}: {
  kind: "supplier" | "payroll";
  state: State;
  connected: boolean;
  busy: boolean;
  change: (action: string, data: unknown) => Promise<void>;
  run: (fn: () => Promise<void>) => void;
}) {
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("All"),
    [workerFilter, setWorkerFilter] = useState("All"),
    [receipt, setReceipt] = useState<Attachment>(),
    [uploading, setUploading] = useState(false),
    [workerType, setWorkerType] = useState<"permanent" | "part-time">(
      "permanent",
    ),
    [basis, setBasis] = useState<Payroll["basis"]>("monthly"),
    [lines, setLines] = useState<BillLine[]>([
      { description: "", quantity: 1, rate: 0 },
    ]);
  const [payReceipt, setPayReceipt] = useState<
    Record<string, Attachment | undefined>
  >({});
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [payNumbers, setPayNumbers] = useState({
    rate: 0,
    units: 1,
    overtimeHours: 0,
    overtimeRate: 0,
    allowance: 0,
    deduction: 0,
  });
  const [tax, setTax] = useState(0),
    [discount, setDiscount] = useState(0);
  const bills = state.bills.filter((b) => b.kind === kind);
  const dueTotal = bills.reduce((a, b) => a + b.amount - b.paid, 0);
  const dueOverdue = bills
    .filter((b) => b.dueDate && b.dueDate < today() && b.paid < b.amount)
    .reduce((a, b) => a + b.amount - b.paid, 0);
  const statusOf = (b: (typeof bills)[number]) =>
    b.paid >= b.amount
      ? "Paid"
      : b.dueDate && b.dueDate < today()
        ? "Overdue"
        : b.paid > 0
          ? "Partial"
          : "Unpaid";
  const visible = bills.filter(
    (b) =>
      (b.party + " " + b.period + " " + (b.contact || ""))
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "All" || statusOf(b) === status) &&
      (workerFilter === "All" || b.payroll?.workerType === workerFilter),
  );
  const subtotal = lines.reduce(
    (n, l) => n + Math.round(l.quantity * l.rate),
    0,
  );
  const net =
    kind === "supplier"
      ? subtotal + tax - discount
      : Math.round(
          payNumbers.rate * (workerType === "permanent" ? 1 : payNumbers.units),
        ) +
        Math.round(payNumbers.overtimeHours * payNumbers.overtimeRate) +
        payNumbers.allowance -
        payNumbers.deduction;
  function num(name: keyof typeof payNumbers, label: string, isMoney = true) {
    return (
      <label>
        {label}
        <input
          type="number"
          min="0"
          step="0.01"
          value={isMoney ? payNumbers[name] / 100 : payNumbers[name]}
          onChange={(e) =>
            setPayNumbers((n) => ({
              ...n,
              [name]: isMoney ? cents(e.target.value) : Number(e.target.value),
            }))
          }
        />
      </label>
    );
  }
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>
            {kind === "supplier" ? "Supplier bills" : "Payroll records"}
          </span>
          <strong>{bills.length}</strong>
          <small>
            {new Set(bills.map((b) => b.party.toLowerCase())).size}{" "}
            {kind === "supplier" ? "suppliers" : "workers"}
          </small>
        </div>
        <div className="stat">
          <span>Total owed</span>
          <strong>{money(dueTotal)}</strong>
          <small>After recorded payments</small>
        </div>
        <div className="stat">
          <span>Paid to date</span>
          <strong>{money(bills.reduce((a, b) => a + b.paid, 0))}</strong>
          <small>All periods</small>
        </div>
        <div className="stat">
          <span>Overdue balance</span>
          <strong>{money(dueOverdue)}</strong>
          <small>Past the recorded due date</small>
        </div>
      </div>
      <div className="toolbar">
        <input
          aria-label="Search records"
          placeholder={
            kind === "supplier"
              ? "Search supplier, invoice or contact"
              : "Search worker or pay period"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Payment status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All", "Unpaid", "Partial", "Paid", "Overdue"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {kind === "payroll" && (
          <select
            aria-label="Worker type filter"
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
          >
            <option value="All">All workers</option>
            <option value="permanent">Permanent</option>
            <option value="part-time">Part-time</option>
          </select>
        )}
        <button className="primary" onClick={() => setAdding(!adding)}>
          {adding
            ? "Close form"
            : kind === "supplier"
              ? "+ Add supplier bill"
              : "+ Add payroll"}
        </button>
      </div>
      {adding && (
        <form
          className="panel"
          onSubmit={(e) => {
            const f = fields(e);
            run(async () => {
              await change("bill", {
                id: draftId,
                kind,
                party: f.party,
                period: f.period,
                amount: Math.max(1, net),
                invoiceDate: f.invoiceDate,
                dueDate: f.dueDate,
                contact: f.contact,
                notes: f.notes,
                receipt,
                ...(kind === "supplier"
                  ? { lines, tax, discount }
                  : {
                      payroll: {
                        workerType,
                        basis,
                        periodStart: f.periodStart,
                        periodEnd: f.periodEnd,
                        ...payNumbers,
                        units:
                          workerType === "permanent" ? 1 : payNumbers.units,
                      },
                    }),
              });
              setAdding(false);
              setReceipt(undefined);
              setDraftId(crypto.randomUUID());
            });
          }}
        >
          <h3>
            {kind === "supplier"
              ? "Supplier invoice details"
              : "Worker & salary breakdown"}
          </h3>
          <div className="three-col">
            <Input
              name="party"
              label={kind === "supplier" ? "Supplier / company" : "Worker name"}
            />
            <Input
              name="period"
              label={
                kind === "supplier"
                  ? "Invoice number"
                  : "Pay period reference (e.g. Oct 2026)"
              }
            />
            <Input
              name="contact"
              label="Phone / email / employee reference"
              required={false}
            />
            <Input
              name="invoiceDate"
              label={kind === "supplier" ? "Invoice date" : "Prepared date"}
              type="date"
              value={today()}
            />
            <Input
              name="dueDate"
              label="Payment due date"
              type="date"
              value={today()}
            />
          </div>
          {kind === "supplier" ? (
            <>
              <h4>Item breakdown</h4>
              <div className="bill-lines">
                {lines.map((l, i) => (
                  <div className="bill-line" key={i}>
                    <label>
                      Description
                      <input
                        required
                        value={l.description}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, n) =>
                              n === i
                                ? { ...r, description: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={l.quantity}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, n) =>
                              n === i
                                ? { ...r, quantity: Number(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Unit price (RM)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={l.rate / 100}
                        onChange={(e) =>
                          setLines((rows) =>
                            rows.map((r, n) =>
                              n === i
                                ? { ...r, rate: cents(e.target.value) }
                                : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <b>{money(Math.round(l.rate * l.quantity))}</b>
                    <button
                      type="button"
                      className="secondary"
                      aria-label={"Remove line " + (i + 1)}
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((rows) => rows.filter((_, n) => n !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setLines((rows) => [
                    ...rows,
                    { description: "", quantity: 1, rate: 0 },
                  ])
                }
              >
                + Add item
              </button>
              <div className="two-col top-space">
                <label>
                  Tax / other invoice charges (RM)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tax / 100}
                    onChange={(e) => setTax(cents(e.target.value))}
                  />
                </label>
                <label>
                  Invoice discount (RM)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount / 100}
                    onChange={(e) => setDiscount(cents(e.target.value))}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="three-col">
                <label>
                  Worker type
                  <select
                    value={workerType}
                    onChange={(e) => {
                      const t = e.target.value as typeof workerType;
                      setWorkerType(t);
                      setBasis(t === "permanent" ? "monthly" : "hourly");
                    }}
                  >
                    <option value="permanent">Permanent</option>
                    <option value="part-time">Part-time</option>
                  </select>
                </label>
                <label>
                  Salary basis
                  <select
                    value={basis}
                    onChange={(e) => setBasis(e.target.value as typeof basis)}
                  >
                    {(workerType === "permanent"
                      ? ["monthly"]
                      : ["hourly", "daily", "event"]
                    ).map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                {num(
                  "rate",
                  workerType === "permanent"
                    ? "Monthly base salary (RM)"
                    : "Rate per " +
                        (basis === "hourly"
                          ? "hour"
                          : basis === "daily"
                            ? "day"
                            : "event") +
                        " (RM)",
                )}
                {workerType === "part-time" &&
                  num(
                    "units",
                    basis === "hourly"
                      ? "Hours worked"
                      : basis === "daily"
                        ? "Days worked"
                        : "Events worked",
                    false,
                  )}
                <Input
                  name="periodStart"
                  label="Period start"
                  type="date"
                  value={today()}
                />
                <Input
                  name="periodEnd"
                  label="Period end"
                  type="date"
                  value={today()}
                />
                {num("overtimeHours", "Overtime hours", false)}
                {num("overtimeRate", "Overtime rate per hour (RM)")}
                {num("allowance", "Allowances / bonus (RM)")}
                {num("deduction", "Deductions (RM)")}
              </div>
              <p className="muted small">
                Base earnings + overtime + allowances − deductions. Enter
                approved figures; statutory deductions and overtime rules are
                not calculated automatically.
              </p>
            </>
          )}
          <div className="balance-box">
            <span>
              {kind === "supplier"
                ? "Subtotal " + money(subtotal)
                : "Calculated net salary"}
            </span>
            <b>
              {kind === "supplier" ? "Invoice total" : "Net payable"}{" "}
              {money(net)}
            </b>
          </div>
          <label>
            Notes / description
            <textarea name="notes" maxLength={1000} />
          </label>
          <Upload
            kind="receipts"
            connected={connected}
            value={receipt}
            onChange={setReceipt}
            onPending={setUploading}
          />
          <button
            className="primary top-space"
            disabled={busy || uploading || net <= 0}
          >
            Save {kind === "supplier" ? "supplier bill" : "payroll"}
          </button>
        </form>
      )}
      <div className="order-grid">
        {visible.map((b) => {
          const history = state.entries.filter(
            (e) =>
              e.billId === b.id ||
              (e.kind === "expense" && e.reference === b.id),
          );
          return (
            <article className="panel" key={b.id}>
              <div className="panel-heading">
                <div>
                  <small className="eyebrow">
                    {b.payroll
                      ? `${b.payroll.workerType} · ${b.payroll.basis}`
                      : kind === "supplier"
                        ? "SUPPLIER INVOICE"
                        : "PAYROLL"}
                  </small>
                  <h3>{b.party}</h3>
                </div>
                <span className={"badge " + statusOf(b).toLowerCase()}>
                  {statusOf(b)}
                </span>
              </div>
              <p>
                <b>{b.period}</b>
                <br />
                <span className="muted small">
                  {b.contact}
                  {b.dueDate && " · Due " + b.dueDate}
                </span>
              </p>
              <div className="balance-box">
                <span>Total {money(b.amount)}</span>
                <span>Paid {money(b.paid)}</span>
                <b>Due {money(b.amount - b.paid)}</b>
              </div>
              <ReceiptLink file={b.receipt} />
              <details className="record-details">
                <summary>Breakdown & payment history</summary>
                {b.lines && (
                  <>
                    <div className="line-items">
                      {b.lines.map((l, i) => (
                        <div key={i}>
                          <span>
                            {l.description} · {l.quantity} × {money(l.rate)}
                          </span>
                          <b>{money(Math.round(l.quantity * l.rate))}</b>
                        </div>
                      ))}
                      <div>
                        <span>Charges / tax</span>
                        <b>{money(b.tax || 0)}</b>
                      </div>
                      <div>
                        <span>Discount</span>
                        <b>−{money(b.discount || 0)}</b>
                      </div>
                    </div>
                  </>
                )}
                {b.payroll && (
                  <div className="line-items">
                    <p>
                      {b.payroll.periodStart} → {b.payroll.periodEnd}
                    </p>
                    <div>
                      <span>
                        Base · {b.payroll.units} × {money(b.payroll.rate)}
                      </span>
                      <b>
                        {money(Math.round(b.payroll.units * b.payroll.rate))}
                      </b>
                    </div>
                    <div>
                      <span>Overtime · {b.payroll.overtimeHours} hours</span>
                      <b>
                        {money(
                          Math.round(
                            b.payroll.overtimeHours * b.payroll.overtimeRate,
                          ),
                        )}
                      </b>
                    </div>
                    <div>
                      <span>Allowances</span>
                      <b>{money(b.payroll.allowance)}</b>
                    </div>
                    <div>
                      <span>Deductions</span>
                      <b>−{money(b.payroll.deduction)}</b>
                    </div>
                  </div>
                )}
                {!b.lines && !b.payroll && (
                  <p className="muted small">
                    Legacy V1 record: original approved amount retained.
                  </p>
                )}
                {b.notes && <p>{b.notes}</p>}
                <h4>Payments</h4>
                {history.map((e) => (
                  <div className="payment-history" key={e.id}>
                    <div className="row between">
                      <span>{e.date}</span>
                      <b>{money(e.amount)}</b>
                    </div>
                    <small>
                      {e.note}
                      <br />
                      Ref: {e.reference}
                    </small>
                    <ReceiptLink file={e.receipt} />
                  </div>
                ))}
                {!history.length && (
                  <p className="muted">No payments recorded.</p>
                )}
              </details>
              {b.paid < b.amount && (
                <details className="record-details">
                  <summary>+ Record payment</summary>
                  <form
                    onSubmit={(e) => {
                      const f = fields(e);
                      run(async () => {
                        await change("paybill", {
                          id: b.id,
                          paymentId: crypto.randomUUID(),
                          amount: cents(f.amount),
                          date: f.date,
                          method: f.method,
                          reference: f.reference,
                          receipt: payReceipt[b.id],
                        });
                        setPayReceipt((p) => ({ ...p, [b.id]: undefined }));
                      });
                    }}
                  >
                    <div className="two-col">
                      <Input
                        name="amount"
                        label="Amount paid (RM)"
                        type="number"
                        min="0.01"
                        step="0.01"
                      />
                      <Input
                        name="date"
                        label="Payment date"
                        type="date"
                        value={today()}
                      />
                      <Method />
                      <Input
                        name="reference"
                        label="Payment reference"
                        required={false}
                      />
                    </div>
                    <Upload
                      kind="receipts"
                      value={payReceipt[b.id]}
                      connected={connected}
                      onChange={(file) =>
                        setPayReceipt((p) => ({ ...p, [b.id]: file }))
                      }
                      onPending={setUploading}
                    />
                    <button
                      className="primary top-space"
                      disabled={busy || uploading}
                    >
                      Save payment
                    </button>
                  </form>
                </details>
              )}
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty">
          <h3>
            No matching{" "}
            {kind === "supplier" ? "supplier bills" : "payroll records"}
          </h3>
          <p>Add a record or adjust your filters.</p>
        </div>
      )}
    </>
  );
}
