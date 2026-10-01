"use client";
import { useMemo, useState } from "react";
import { BarChart3, Printer } from "lucide-react";
import { money, monthlyReport, paid, type State } from "@/lib/domain";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const printReport = (section: string) => {
  document.body.dataset.printReport = section;
  window.print();
  setTimeout(() => delete document.body.dataset.printReport, 250);
};

export function Reports({ state }: { state: State }) {
  const [month, setMonth] = useState(currentMonth());
  const report = useMemo(
    () => monthlyReport(structuredClone(state), month),
    [state, month],
  );
  const label = new Date(month + "-01T12:00:00").toLocaleString("en-MY", {
    month: "long",
    year: "numeric",
  });
  const chart = [
    ["Order value", report.orderValue, "green"],
    ["Cash received", report.received, "sage"],
    ["Suppliers", report.supplierPaid, "gold"],
    ["Payroll", report.payrollPaid, "terracotta"],
    ["Other costs", report.otherExpenses, "grey"],
  ] as const;
  const max = Math.max(...chart.map((x) => x[1]), 1);
  const statuses = ["Pending", "Confirmed", "Preparing", "Completed"].map(
    (status) => ({
      status,
      count: report.orders.filter((o) => o.status === status).length,
    }),
  );
  return (
    <div className="report" id="monthly-report">
      <div className="report-controls no-print">
        <label>
          Reporting month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="secondary" onClick={() => printReport("full")}>
            <Printer size={16} /> Print full report
          </button>
          <button className="text-button" onClick={() => printReport("orders")}>
            Print orders
          </button>
          <button
            className="text-button"
            onClick={() => printReport("suppliers")}
          >
            Print suppliers
          </button>
          <button
            className="text-button"
            onClick={() => printReport("payroll")}
          >
            Print payroll
          </button>
        </div>
      </div>
      <header className="report-cover">
        <div>
          <p className="eyebrow">MONTHLY BUSINESS REPORT</p>
          <h2>{label}</h2>
          <p>
            {state.settings.company} · Prepared{" "}
            {new Date().toLocaleDateString("en-MY")}
          </p>
        </div>
        <div className="report-mark">
          <BarChart3 />
          <span>Management report</span>
        </div>
      </header>
      <section
        className="report-section report-summary"
        data-report-section="summary"
      >
        <div className="stats report-kpis">
          <ReportStat
            label="Order value"
            value={money(report.orderValue)}
            note={`${report.orders.length} non-cancelled orders`}
          />
          <ReportStat
            label="Cash received"
            value={money(report.received)}
            note="Payments less refunds"
          />
          <ReportStat
            label="Operating expenses"
            value={money(report.expenses)}
            note="Suppliers, payroll and other"
          />
          <ReportStat
            label="Net cash movement"
            value={money(report.netCash)}
            note={
              report.netCash >= 0 ? "Positive cash flow" : "Negative cash flow"
            }
          />
        </div>
        <div className="report-grid">
          <div className="panel report-chart">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">FINANCIAL PROFILE</p>
                <h3>Income and spending</h3>
              </div>
            </div>
            <div className="bar-chart">
              {chart.map(([name, value, color]) => (
                <div className="bar-row" key={name}>
                  <span>{name}</span>
                  <div className="bar-track">
                    <i
                      className={`bar-fill ${color}`}
                      style={{
                        width: `${Math.max(value ? 4 : 0, (value / max) * 100)}%`,
                      }}
                    />
                  </div>
                  <b>{money(value)}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="panel report-insight">
            <p className="eyebrow">OPERATING SNAPSHOT</p>
            <h3>{report.guests} guests served</h3>
            <dl>
              <div>
                <dt>Average order</dt>
                <dd>
                  {money(
                    report.orders.length
                      ? Math.round(report.orderValue / report.orders.length)
                      : 0,
                  )}
                </dd>
              </div>
              <div>
                <dt>Customer balances</dt>
                <dd>{money(report.outstanding)}</dd>
              </div>
              <div>
                <dt>Supplier invoices</dt>
                <dd>{report.supplierTransactions.length}</dd>
              </div>
              <div>
                <dt>Payroll records</dt>
                <dd>{report.payroll.length}</dd>
              </div>
            </dl>
            <div className="status-strip">
              {statuses.map((x) => (
                <span key={x.status}>
                  <b>{x.count}</b>
                  {x.status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="panel report-section" data-report-section="orders">
        <ReportHeading
          title="Orders"
          subtitle={`${report.orders.length} events in ${label}`}
          onPrint={() => printReport("orders")}
        />
        <div className="report-table">
          <div className="report-row report-table-head">
            <span>Date / reference</span>
            <span>Customer</span>
            <span>Event</span>
            <span>Status</span>
            <span className="number">Value</span>
            <span className="number">Received</span>
          </div>
          {report.orders.map((order) => (
            <div className="report-row" key={order.id}>
              <span>
                {order.date}
                <small>{order.id.slice(0, 8).toUpperCase()}</small>
              </span>
              <span>
                {order.name}
                <small>{order.phone}</small>
              </span>
              <span>
                {order.pax} guests<small>{order.time}</small>
              </span>
              <span>{order.status}</span>
              <span className="number">{money(order.total)}</span>
              <span className="number">{money(paid(state, order.id))}</span>
            </div>
          ))}
          {!report.orders.length && (
            <p className="empty-report">No orders for this month.</p>
          )}
        </div>
        <div className="report-total">
          <span>Order value</span>
          <strong>{money(report.orderValue)}</strong>
        </div>
      </section>
      <section className="panel report-section" data-report-section="suppliers">
        <ReportHeading
          title="Supplier transactions"
          subtitle={`${report.supplierTransactions.length} invoices in ${label}`}
          onPrint={() => printReport("suppliers")}
        />
        <div className="report-table">
          <div className="report-row report-table-head five">
            <span>Date / invoice</span>
            <span>Supplier</span>
            <span>Items</span>
            <span className="number">Total</span>
            <span className="number">Outstanding</span>
          </div>
          {report.supplierTransactions.map(({ supplier, transaction }) => (
            <div className="report-row five" key={transaction.id}>
              <span>
                {transaction.invoiceDate}
                <small>{transaction.reference}</small>
              </span>
              <span>
                {supplier.name}
                <small>{supplier.contact}</small>
              </span>
              <span>{transaction.lines.length || "—"}</span>
              <span className="number">{money(transaction.amount)}</span>
              <span className="number">
                {money(transaction.amount - transaction.paid)}
              </span>
            </div>
          ))}
          {!report.supplierTransactions.length && (
            <p className="empty-report">
              No supplier transactions for this month.
            </p>
          )}
        </div>
        <div className="report-total">
          <span>Supplier cash paid this month</span>
          <strong>{money(report.supplierPaid)}</strong>
        </div>
      </section>
      <section className="panel report-section" data-report-section="payroll">
        <ReportHeading
          title="Payroll"
          subtitle={`${report.payroll.length} payments in ${label}`}
          onPrint={() => printReport("payroll")}
        />
        <div className="report-table">
          <div className="report-row report-table-head five">
            <span>Paid / period</span>
            <span>Worker</span>
            <span>Type</span>
            <span>Adjustments</span>
            <span className="number">Net paid</span>
          </div>
          {report.payroll.map(({ worker, payment }) => (
            <div className="report-row five" key={payment.id}>
              <span>
                {payment.date}
                <small>{payment.period}</small>
              </span>
              <span>
                {worker.name}
                <small>{worker.contact}</small>
              </span>
              <span>
                {worker.workerType}
                <small>{worker.basis}</small>
              </span>
              <span>
                OT{" "}
                {money(
                  Math.round(payment.overtimeHours * payment.overtimeRate),
                )}
                <small>
                  Bonus {money(payment.bonus)} · Advance{" "}
                  {money(payment.advance)} · Deduction{" "}
                  {money(payment.deduction)}
                </small>
              </span>
              <span className="number">{money(payment.amount)}</span>
            </div>
          ))}
          {!report.payroll.length && (
            <p className="empty-report">No payroll payments for this month.</p>
          )}
        </div>
        <div className="report-total">
          <span>Total payroll paid</span>
          <strong>{money(report.payrollPaid)}</strong>
        </div>
      </section>
      <section className="panel report-section" data-report-section="summary">
        <ReportHeading
          title="Transaction ledger"
          subtitle="Cash movement recorded during the month"
        />
        <div className="report-table">
          <div className="report-row report-table-head five">
            <span>Date</span>
            <span>Type</span>
            <span>Category</span>
            <span>Reference / note</span>
            <span className="number">Amount</span>
          </div>
          {report.entries.map((entry) => (
            <div className="report-row five" key={entry.id}>
              <span>{entry.date}</span>
              <span>{entry.kind}</span>
              <span>{entry.category}</span>
              <span>
                {entry.reference}
                <small>{entry.note}</small>
              </span>
              <span className="number">
                {entry.kind === "expense" || entry.kind === "refund"
                  ? "−"
                  : "+"}
                {money(entry.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function ReportHeading({
  title,
  subtitle,
  onPrint,
}: {
  title: string;
  subtitle: string;
  onPrint?: () => void;
}) {
  return (
    <div className="panel-heading report-heading">
      <div>
        <h3>{title}</h3>
        <p className="muted">{subtitle}</p>
      </div>
      {onPrint && (
        <button className="text-button no-print" onClick={onPrint}>
          <Printer size={15} /> Print section
        </button>
      )}
    </div>
  );
}
