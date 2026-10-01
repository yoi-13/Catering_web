"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ConfirmPayment,
  Upload,
  ReceiptLink,
  SupplierWorkspace,
  PayrollWorkspace,
} from "./Accounting";
import { Reports } from "./Reports";
import type { Attachment } from "@/lib/domain";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  ShoppingBag,
  Leaf,
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Wallet,
  Settings,
  LogOut,
  Search,
  Check,
  CalendarDays,
  Download,
  Users,
  X,
  Menu as MenuIcon,
} from "lucide-react";
import {
  initial,
  mutate,
  place,
  paid,
  money,
  today,
  normalizeState,
  type State,
  type Order,
  type Menu,
} from "@/lib/domain";
const KEY = "gather-v1-demo";
const uid = () => crypto.randomUUID();
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
const form = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
};
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message.startsWith("[")
      ? "Please check the form fields."
      : e.message
    : "Something went wrong.";
const nav = [
  ["Overview", LayoutDashboard],
  ["Orders", ClipboardList],
  ["Menus", UtensilsCrossed],
  ["Finances", Wallet],
  ["Suppliers", Users],
  ["Payroll", Users],
  ["Reports", Download],
  ["Settings", Settings],
] as const;
export default function App({ connected }: { connected: boolean }) {
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null);
  const [qrDraft, setQrDraft] = useState<Attachment | null | undefined>();
  const [qrUploading, setQrUploading] = useState(false);
  const [state, setState] = useState<State>(structuredClone(initial));
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("shop");
  const [section, setSection] = useState("Overview");
  const [signed, setSigned] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("All");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(Order & { paid?: number }) | null>(
    null,
  );
  const [edit, setEdit] = useState<Menu | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  async function api(action: string, data: unknown) {
    const r = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    const value = await r.json();
    if (!r.ok) throw Error(value.error);
    return value;
  }
  async function refresh(admin = false) {
    const r = await fetch("/api/data" + (admin ? "?admin=1" : ""), {
      cache: "no-store",
    });
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) setSigned(false);
      throw Error(data.error);
    }
    setState((s) => (admin ? data : { ...s, ...data }));
  }
  useEffect(() => {
    (async () => {
      try {
        if (connected) await refresh();
        else {
          const raw = localStorage.getItem(KEY);
          if (raw) setState(normalizeState(JSON.parse(raw)));
        }
        const fragment = location.hash.slice(1);
        if (fragment.startsWith("track=")) {
          setView("track");
          const t = fragment.slice(6);
          if (connected) setResult(await api("track", { token: t }));
          else {
            const s = JSON.parse(
              localStorage.getItem(KEY) || JSON.stringify(initial),
            ) as State;
            const o = s.orders.find((o) => o.token === t);
            if (o) setResult({ ...o, paid: paid(s, o.id) });
          }
        }
      } catch (e) {
        setNotice(errorText(e));
      } finally {
        setReady(true);
      }
    })();
  }, [connected]);
  function save(s: State) {
    localStorage.setItem(KEY, JSON.stringify(s));
    setState(s);
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await work();
    } catch (e) {
      setNotice(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function change(action: string, data: unknown) {
    if (connected) {
      await api(action, data);
      await refresh(true);
    } else {
      const s = structuredClone(state);
      mutate(s, action, data);
      save(s);
    }
    setNotice("Saved successfully.");
  }
  const items = state.menus.filter((m) => m.active);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = items.reduce((a, m) => a + m.price * (cart[m.id] || 0), 0);
  const qty = (id: string, n: number) =>
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(10000, (c[id] || 0) + n)),
    }));
  const go = (v: string) => {
    setView(v);
    setNotice("");
    if (v !== "track") history.replaceState(null, "", location.pathname);
  };
  const visibleEntries = state.entries.filter(
    (e) => (!from || e.date >= from) && (!to || e.date <= to),
  );
  const received = visibleEntries.reduce(
    (a, e) =>
      a +
      (e.kind === "payment" ? e.amount : e.kind === "refund" ? -e.amount : 0),
    0,
  );
  const expenses = visibleEntries
    .filter((e) => e.kind === "expense")
    .reduce((a, e) => a + e.amount, 0);
  const outstanding = state.orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((a, o) => a + o.total - paid(state, o.id), 0);
  function csv() {
    const rows = [
      ["Date", "Type", "Category", "Amount MYR", "Order", "Reference", "Note"],
      ...visibleEntries.map((e) => [
        e.date,
        e.kind,
        e.category,
        (e.amount / 100).toFixed(2),
        e.orderId,
        e.reference,
        e.note,
      ]),
    ];
    const data = rows
      .map((r) =>
        r
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "gather-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const badge = (status: string) => (
    <span className={"badge " + status.toLowerCase()}>{status}</span>
  );
  function orderCard(o: Order & { paid?: number }) {
    return (
      <div className="panel confirmation">
        <div className="check-icon">
          <Check />
        </div>
        <p className="eyebrow">YOUR GATHERING</p>
        <h2>
          {o.status === "Pending"
            ? "Request received."
            : o.status === "Cancelled"
              ? "Order cancelled."
              : "Your order, at a glance."}
        </h2>
        <p>
          Reference {o.id.slice(0, 8).toUpperCase()} · {badge(o.status)}
        </p>
        <div className="detail-grid">
          <div>
            <small>EVENT</small>
            <b>
              {o.date} at {o.time}
            </b>
          </div>
          <div>
            <small>GUESTS</small>
            <b>{o.pax} people</b>
          </div>
          <div>
            <small>TOTAL</small>
            <b>{money(o.total)}</b>
          </div>
          <div>
            <small>RECEIVED</small>
            <b>{money(o.paid ?? 0)}</b>
          </div>
        </div>
        <div className="line-items">
          {o.items.map((i, n) => (
            <div key={n}>
              <span>
                {i.name} × {i.qty}
              </span>
              <b>{money(i.price * i.qty)}</b>
            </div>
          ))}
        </div>
        <p>{o.address}</p>
        <div className="payment-instructions">
          <b>
            {o.method === "cash"
              ? "Pay by cash"
              : o.method === "qr"
                ? "Pay by QR"
                : "Bank transfer"}
          </b>
          {o.method === "cash" ? (
            <p>
              Pay the team when collecting or receiving your order. The
              administrator records cash after collection.
            </p>
          ) : (
            <>
              <p>
                {state.settings.bank && state.settings.account
                  ? `${state.settings.bank} · ${state.settings.account} · ${state.settings.holder}`
                  : "Payment details have not been configured. Please wait for the administrator to confirm your order and provide instructions."}
              </p>
              {o.method === "qr" && state.settings.qr && (
                <img
                  className="qr"
                  src={state.settings.qr}
                  alt="Merchant payment QR code"
                />
              )}
              <p>
                Use {o.id.slice(0, 8).toUpperCase()} as your reference. Payment
                is confirmed only after the administrator verifies it.
              </p>
            </>
          )}
        </div>
        <label>
          Private tracking code
          <input readOnly value={o.token} />
        </label>
        <p className="muted small">
          Save this code to return to your order. Anyone with the code can view
          it.
        </p>
        <div className="row">
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(
                  location.origin + "/#track=" + o.token,
                );
                setNotice("Private tracking link copied.");
              })
            }
          >
            Copy tracking link
          </button>
          <button className="secondary" onClick={() => window.print()}>
            Print order summary
          </button>
        </div>
      </div>
    );
  }
  if (!ready)
    return (
      <main className="loading">
        <Leaf />
        <h2>Setting the table…</h2>
      </main>
    );
  return (
    <>
      <div className="demo-strip">
        {connected
          ? "CONNECTED WORKSPACE · Supabase storage"
          : "EXPERIMENTAL DEMO · Data stays in this browser · No real payments are processed"}
      </div>
      {confirmOrder && (
        <ConfirmPayment
          order={confirmOrder}
          state={state}
          connected={connected}
          busy={busy}
          cancel={() => setConfirmOrder(null)}
          submit={(data) =>
            run(async () => {
              await change("confirm", data);
              setConfirmOrder(null);
            })
          }
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {view === "admin" && signed ? (
        <div className="admin-shell">
          <aside>
            <a className="brand" onClick={() => go("shop")}>
              <span className="brand-icon">
                <Leaf size={22} />
              </span>
              gather<span className="brand-dot">.</span>
            </a>
            <p className="sidebar-label">YOUR WORKSPACE</p>
            <nav>
              {nav.map(([name, Icon]) => (
                <button
                  key={name}
                  className={section === name ? "selected" : ""}
                  onClick={() => {
                    setSection(name);
                    setEdit(null);
                  }}
                >
                  <Icon size={18} />
                  {name}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <p>
                <span className="online-dot" />{" "}
                {connected ? "Shared workspace" : "Demo workspace"}
              </p>
              <button onClick={() => go("shop")}>
                <ArrowUpRight size={18} /> Open storefront
              </button>
              <button
                onClick={() =>
                  run(async () => {
                    if (connected) await api("logout", {});
                    setSigned(false);
                    go("shop");
                  })
                }
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </aside>
          <main className="admin-main">
            <header className="admin-top">
              <span>
                Catering workspace <span className="muted">/ {section}</span>
              </span>
              <span className="avatar">D</span>
            </header>
            <div className="admin-content">
              <div className="page-title">
                <div>
                  <p className="eyebrow">MAKE ROOM FOR GOOD THINGS</p>
                  <h1>
                    {section === "Overview"
                      ? "A little clarity. A lot of possibility."
                      : section === "Reports"
                        ? "Monthly performance"
                        : section}
                  </h1>
                  <p className="muted">
                    {section === "Overview"
                      ? "Here’s what’s happening around your table."
                      : section === "Reports"
                        ? "Review sales, cash flow, supplier costs and payroll in one place."
                        : "Keep the details organised, so every gathering runs smoothly."}
                  </p>
                </div>
                {section === "Menus" && (
                  <button
                    className="primary"
                    onClick={() =>
                      setEdit({
                        id: uid(),
                        name: "",
                        description: "",
                        category: "Mains",
                        price: 1000,
                        active: true,
                        emoji: "🍽️",
                      })
                    }
                  >
                    <Plus size={17} /> Add menu
                  </button>
                )}
              </div>
              {section === "Overview" && (
                <>
                  <div className="stats">
                    <Stat
                      title="Order value"
                      value={money(
                        state.orders
                          .filter((o) => o.status !== "Cancelled")
                          .reduce((a, o) => a + o.total, 0),
                      )}
                      hint="All non-cancelled orders"
                    />
                    <Stat
                      title="Money received"
                      value={money(received)}
                      hint="Verified payments less refunds"
                    />
                    <Stat
                      title="Customer balances"
                      value={money(outstanding)}
                      hint="Still to be collected"
                    />
                    <Stat
                      title="Upcoming gatherings"
                      value={String(
                        state.orders.filter(
                          (o) =>
                            o.date >= today() &&
                            !["Cancelled", "Completed"].includes(o.status),
                        ).length,
                      )}
                      hint="Pending and active events"
                    />
                  </div>
                  <div className="overview-grid">
                    <div className="panel">
                      <div className="panel-heading">
                        <h3>Upcoming gatherings</h3>
                        <button
                          className="text-button"
                          onClick={() => setSection("Orders")}
                        >
                          View orders <ArrowRight size={15} />
                        </button>
                      </div>
                      {state.orders
                        .filter(
                          (o) =>
                            o.date >= today() &&
                            !["Cancelled", "Completed"].includes(o.status),
                        )
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .slice(0, 5)
                        .map((o) => (
                          <div className="event-row" key={o.id}>
                            <span className="date-tile">
                              {o.date.slice(8)}
                              <small>
                                {new Date(o.date + "T12:00:00").toLocaleString(
                                  "en",
                                  { month: "short" },
                                )}
                              </small>
                            </span>
                            <div>
                              <b>{o.name}</b>
                              <p>
                                {o.pax} guests · {o.time}
                              </p>
                            </div>
                            {badge(o.status)}
                          </div>
                        ))}
                      {!state.orders.length && (
                        <Empty
                          title="Your next gathering starts here"
                          text="Place a test order from the storefront to see your workflow come to life."
                        />
                      )}
                    </div>
                    <div className="green-panel">
                      <Leaf size={32} />
                      <h2>
                        Good food.
                        <br />
                        Less paperwork.
                      </h2>
                      <p>Your menus, orders and money, all at one table.</p>
                      <button onClick={() => go("shop")}>
                        Try the customer experience <ArrowUpRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="panel">
                    <h3>V1 workspace</h3>
                    <div className="three-col">
                      <div>
                        <b>01 · Curate your menu</b>
                        <p className="muted">
                          Edit dishes and prices. Archive items without changing
                          existing orders.
                        </p>
                      </div>
                      <div>
                        <b>02 · Welcome an order</b>
                        <p className="muted">
                          Review event requests, then confirm and prepare each
                          gathering.
                        </p>
                      </div>
                      <div>
                        <b>03 · Keep the books clear</b>
                        <p className="muted">
                          Record verified payments, expenses, supplier bills and
                          payroll periods.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {section === "Orders" && (
                <>
                  <div className="toolbar">
                    <label className="search">
                      <Search size={17} />
                      <input
                        placeholder="Search customer or reference"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        "All",
                        "Pending",
                        "Confirmed",
                        "Preparing",
                        "Completed",
                        "Cancelled",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </div>
                  <div className="order-grid">
                    {state.orders
                      .filter(
                        (o) =>
                          (filter === "All" || o.status === filter) &&
                          (o.name + " " + o.id)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((o) => (
                        <div className="panel" key={o.id}>
                          <div className="panel-heading">
                            <div>
                              <small className="muted">
                                #{o.id.slice(0, 8).toUpperCase()}
                              </small>
                              <h3>{o.name}</h3>
                            </div>
                            {badge(o.status)}
                          </div>
                          <p>
                            <CalendarDays size={15} /> {o.date} · {o.time} ·{" "}
                            {o.pax} guests
                          </p>
                          <p className="muted">
                            {o.phone} · {o.address}
                          </p>
                          <div className="line-items">
                            {o.items.map((i, n) => (
                              <div key={n}>
                                <span>
                                  {i.qty} × {i.name}
                                </span>
                                <b>{money(i.qty * i.price)}</b>
                              </div>
                            ))}
                          </div>
                          {o.note && <p className="muted">Note: {o.note}</p>}
                          <div className="row between">
                            <b>{money(o.total)}</b>
                            <span className="muted">
                              Balance {money(o.total - paid(state, o.id))} ·{" "}
                              {o.method}
                            </span>
                          </div>
                          <div className="row wrap top-space">
                            {(
                              {
                                Pending: ["Confirmed", "Cancelled"],
                                Confirmed: ["Preparing", "Cancelled"],
                                Preparing: ["Completed", "Cancelled"],
                              } as Record<string, string[]>
                            )[o.status]?.map((status) => (
                              <button
                                disabled={busy}
                                className={
                                  status === "Cancelled"
                                    ? "secondary"
                                    : "primary"
                                }
                                key={status}
                                onClick={() =>
                                  run(() =>
                                    status === "Confirmed"
                                      ? Promise.resolve(setConfirmOrder(o))
                                      : change("status", { id: o.id, status }),
                                  )
                                }
                              >
                                {status === "Cancelled"
                                  ? "Cancel order"
                                  : status === "Confirmed"
                                    ? "Confirm & record payment"
                                    : "Mark " + status.toLowerCase()}
                              </button>
                            ))}
                            <button
                              className="text-button"
                              onClick={() => setSection("Finances")}
                            >
                              Record payment →
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  {!state.orders.length && (
                    <Empty
                      title="No orders yet"
                      text="Your customer orders will appear here."
                    />
                  )}
                </>
              )}
              {section === "Menus" && (
                <>
                  {edit && (
                    <form
                      className="panel editor"
                      onSubmit={(e) => {
                        const f = form(e);
                        run(async () => {
                          await change("menu", {
                            ...edit,
                            name: f.name,
                            description: f.description,
                            category: f.category,
                            price: Math.round(Number(f.price) * 100),
                            emoji: f.emoji,
                            active: f.active === "on",
                          });
                          setEdit(null);
                        });
                      }}
                    >
                      <div className="panel-heading">
                        <h3>Edit menu</h3>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => setEdit(null)}
                          aria-label="Close menu editor"
                        >
                          <X />
                        </button>
                      </div>
                      <div className="three-col">
                        <Field label="Name" name="name" value={edit.name} />
                        <Field
                          label="Price per person (RM)"
                          name="price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={edit.price / 100}
                        />
                        <Field
                          label="Menu symbol"
                          name="emoji"
                          value={edit.emoji}
                        />
                      </div>
                      <label>
                        Description
                        <textarea
                          name="description"
                          defaultValue={edit.description}
                        />
                      </label>
                      <div className="row">
                        <select name="category" defaultValue={edit.category}>
                          {["Packages", "Mains", "Desserts", "Drinks"].map(
                            (x) => (
                              <option key={x}>{x}</option>
                            ),
                          )}
                        </select>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={edit.active}
                          />{" "}
                          Available to order
                        </label>
                        <button className="primary" disabled={busy}>
                          Save menu
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="menu-grid">
                    {state.menus.map((m) => (
                      <div className="panel menu-admin" key={m.id}>
                        <span className="menu-emoji">{m.emoji}</span>
                        <div>
                          <small className="eyebrow">{m.category}</small>
                          <h3>{m.name}</h3>
                          <p className="muted">{m.description}</p>
                          <div className="row between">
                            <b>{money(m.price)} / pax</b>
                            {badge(m.active ? "Available" : "Archived")}
                          </div>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setEdit(m)}
                        >
                          Edit menu
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {section === "Finances" && (
                <>
                  <div className="toolbar">
                    <label>
                      From
                      <input
                        aria-label="From date"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      To
                      <input
                        aria-label="To date"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                    <button className="secondary" onClick={csv}>
                      <Download size={16} /> Export CSV
                    </button>
                  </div>
                  <div className="stats">
                    <Stat
                      title="Net receipts"
                      value={money(received)}
                      hint="Payments minus refunds, selected dates"
                    />
                    <Stat
                      title="Expenses paid"
                      value={money(expenses)}
                      hint="Includes supplier and payroll payments"
                    />
                    <Stat
                      title="Net cash movement"
                      value={money(received - expenses)}
                      hint="Cash movement, not accounting profit"
                    />
                    <Stat
                      title="Customer balances"
                      value={money(outstanding)}
                      hint="All dates, excluding cancelled orders"
                    />
                  </div>
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      const f = form(e);
                      const el = e.currentTarget;
                      run(async () => {
                        await change("entry", {
                          ...f,
                          id: uid(),
                          amount: Math.round(Number(f.amount) * 100),
                        });
                        el.reset();
                      });
                    }}
                  >
                    <h3>Record a transaction</h3>
                    <p className="muted small">
                      Record payments only after checking your bank or
                      collecting cash. Records are retained; use refunds to
                      reverse customer payments.
                    </p>
                    <div className="three-col">
                      <label>
                        Type
                        <select name="kind">
                          <option value="payment">Customer payment</option>
                          <option value="refund">Customer refund</option>
                          <option value="expense">Business expense</option>
                        </select>
                      </label>
                      <label>
                        Order (payments / refunds)
                        <select name="orderId">
                          <option value="">Choose order</option>
                          {state.orders.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.id.slice(0, 8)} · {o.name} ·{" "}
                              {money(o.total - paid(state, o.id))} due
                            </option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label="Amount (RM)"
                        name="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                      />
                      <Field
                        label="Date"
                        name="date"
                        type="date"
                        value={today()}
                      />
                      <label>
                        Category / method
                        <select name="category">
                          {[
                            "Bank transfer",
                            "QR payment",
                            "Cash",
                            "Ingredients",
                            "Transport",
                            "Utilities",
                            "Other",
                          ].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                      <Field
                        label="Bank / receipt reference"
                        name="reference"
                        required={false}
                      />
                    </div>
                    <label>
                      Notes
                      <textarea name="note" />
                    </label>
                    <button className="primary" disabled={busy}>
                      <Plus size={17} /> Save transaction
                    </button>
                  </form>
                  <div className="panel table-wrap">
                    <h3>Transaction history</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Reference / notes</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((e) => (
                          <tr key={e.id}>
                            <td>{e.date}</td>
                            <td>{badge(e.kind)}</td>
                            <td>{e.category}</td>
                            <td>
                              {e.reference}
                              <ReceiptLink file={e.receipt} />
                              <small className="block muted">{e.note}</small>
                            </td>
                            <td className="number">
                              {e.kind === "payment" ? "+" : "−"}
                              {money(e.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleEntries.length && (
                      <Empty
                        title="A clean ledger"
                        text="Verified payments and expenses will appear here."
                      />
                    )}
                  </div>
                </>
              )}
              {section === "Suppliers" && (
                <SupplierWorkspace
                  state={state}
                  connected={connected}
                  busy={busy}
                  change={change}
                  run={run}
                />
              )}
              {section === "Payroll" && (
                <PayrollWorkspace
                  state={state}
                  connected={connected}
                  busy={busy}
                  change={change}
                  run={run}
                />
              )}
              {section === "Reports" && <Reports state={state} />}
              {section === "Settings" && (
                <form
                  className="panel settings-form"
                  onSubmit={(e) => {
                    const f = form(e);
                    run(() =>
                      change("settings", {
                        ...f,
                        qrFile:
                          qrDraft === undefined
                            ? state.settings.qrFile
                            : qrDraft || undefined,
                        qr: (
                          qrDraft === undefined
                            ? state.settings.qrFile
                            : qrDraft
                        )
                          ? "/api/files?qr=1"
                          : qrDraft === null
                            ? ""
                            : state.settings.qr,
                        leadDays: Number(f.leadDays),
                        minPax: Number(f.minPax),
                        capacity: Number(f.capacity),
                      }),
                    );
                  }}
                >
                  <h3>The details behind your table</h3>
                  <Field
                    label="Company name"
                    name="company"
                    value={state.settings.company}
                  />
                  <h4>Payment instructions</h4>
                  <p className="muted small">
                    Use test details while experimenting. QR payments are
                    verified manually in V1.
                  </p>
                  <div className="three-col">
                    <Field
                      label="Bank name"
                      name="bank"
                      value={state.settings.bank}
                      required={false}
                    />
                    <Field
                      label="Account number"
                      name="account"
                      value={state.settings.account}
                      required={false}
                    />
                    <Field
                      label="Account holder"
                      name="holder"
                      value={state.settings.holder}
                      required={false}
                    />
                  </div>
                  <Upload
                    kind="qr"
                    connected={connected}
                    value={
                      qrDraft === undefined
                        ? state.settings.qrFile
                        : qrDraft || undefined
                    }
                    onChange={(f) => setQrDraft(f || null)}
                    onPending={setQrUploading}
                  />
                  {(qrDraft === undefined
                    ? state.settings.qrFile
                    : qrDraft) && (
                    <img
                      className="qr top-space"
                      alt="Merchant QR preview"
                      src={
                        "/api/files?path=" +
                        encodeURIComponent(
                          (qrDraft === undefined
                            ? state.settings.qrFile
                            : qrDraft)!.path,
                        )
                      }
                    />
                  )}
                  {!state.settings.qrFile &&
                    qrDraft === undefined &&
                    state.settings.qr && (
                      <img
                        className="qr"
                        src={state.settings.qr}
                        alt="Current merchant QR"
                      />
                    )}
                  <p className="muted small">
                    Choose an image, then Save settings. Replacing the image
                    preserves the original file for existing records.
                  </p>
                  <h4>Booking rules</h4>
                  <div className="three-col">
                    <Field
                      label="Minimum guests"
                      name="minPax"
                      type="number"
                      min="1"
                      value={state.settings.minPax}
                    />
                    <Field
                      label="Advance notice (days)"
                      name="leadDays"
                      type="number"
                      min="0"
                      value={state.settings.leadDays}
                    />
                    <Field
                      label="Maximum guests per date"
                      name="capacity"
                      type="number"
                      min="1"
                      value={state.settings.capacity}
                    />
                  </div>
                  <button className="primary" disabled={busy || qrUploading}>
                    Save settings
                  </button>
                  <p className="muted small">
                    V1 uses MYR and UTC dates for booking and report cutoffs.
                    Connected administrator credentials are configured on the
                    server.
                  </p>
                </form>
              )}
            </div>
          </main>
        </div>
      ) : (
        <>
          <header className="public-header">
            <a className="brand" onClick={() => go("shop")}>
              <span className="brand-icon">
                <Leaf size={22} />
              </span>
              gather<span className="brand-dot">.</span>
            </a>
            <nav>
              <button
                className={view === "shop" ? "active" : ""}
                onClick={() => go("shop")}
              >
                Our menu
              </button>
              <button
                className={view === "track" ? "active" : ""}
                onClick={() => {
                  setResult(null);
                  go("track");
                }}
              >
                Track order
              </button>
              <button onClick={() => go(signed ? "admin" : "login")}>
                Workspace <ArrowUpRight size={14} />
              </button>
            </nav>
            <button
              className="cart-button"
              onClick={() => go("checkout")}
              aria-label="Open your order"
            >
              <ShoppingBag size={18} />
              <span>Your order</span>
              <b>{count}</b>
            </button>
          </header>
          <main className="public-main">
            {view === "shop" && (
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <p className="eyebrow">
                      <span className="online-dot" /> MADE FOR SHARING
                    </p>
                    <h1>
                      Good food.
                      <br />
                      Great company.
                      <br />
                      <em>Gather together.</em>
                    </h1>
                    <p>
                      From small celebrations to a full house.
                      <br />
                      Thoughtful catering, made simple.
                    </p>
                    <button
                      className="primary"
                      onClick={() =>
                        document
                          .getElementById("menu")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Find your perfect menu <ArrowRight size={17} />
                    </button>
                    <div className="hero-foot">
                      <span>
                        <Check size={15} /> Freshly prepared
                      </span>
                      <span>
                        <Check size={15} /> From {state.settings.minPax} guests
                      </span>
                    </div>
                  </div>
                  <div className="hero-art">
                    <div className="art-ring ring-one" />
                    <div className="art-ring ring-two" />
                    <div className="plate">
                      <div className="plate-inner">
                        <span className="food-rice">🍚</span>
                        <span className="food-leaf">🥬</span>
                        <span className="food-chicken">🍗</span>
                        <span className="food-tomato">🍅</span>
                      </div>
                    </div>
                    <div className="art-label">
                      <span>THE SECRET INGREDIENT?</span>
                      <b>A little togetherness.</b>
                    </div>
                    <span className="art-spark">✳</span>
                    <div className="floating-note">
                      <Leaf size={20} />
                      <div>
                        Something for everyone
                        <small>Curated menus · Honest prices</small>
                      </div>
                    </div>
                  </div>
                </section>
                <section id="menu" className="menu-section">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">A PLACE AT THE TABLE</p>
                      <h2>What are we sharing?</h2>
                    </div>
                    <p className="muted">
                      Pick your favourites. We’ll take care of the rest.
                    </p>
                  </div>
                  <div className="tabs">
                    {["All", "Packages", "Mains", "Desserts", "Drinks"].map(
                      (c) => (
                        <button
                          className={category === c ? "selected" : ""}
                          key={c}
                          onClick={() => setCategory(c)}
                        >
                          {c === "All" ? "The whole menu" : c}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="menu-grid">
                    {items
                      .filter(
                        (m) => category === "All" || m.category === category,
                      )
                      .map((m, i) => (
                        <article className="food-card" key={m.id}>
                          <div className={"food-art tone-" + (i % 4)}>
                            <span>{m.emoji}</span>
                            <small>{m.category}</small>
                          </div>
                          <div className="food-body">
                            <p className="eyebrow">{m.category}</p>
                            <h3>{m.name}</h3>
                            <p className="description">{m.description}</p>
                            <div className="row between">
                              <div>
                                <b className="price">{money(m.price)}</b>
                                <small className="muted"> / person</small>
                              </div>
                              {cart[m.id] ? (
                                <div className="quantity">
                                  <button
                                    aria-label={"Remove " + m.name}
                                    onClick={() => qty(m.id, -1)}
                                  >
                                    <Minus size={15} />
                                  </button>
                                  <span>{cart[m.id]}</span>
                                  <button
                                    aria-label={"Add " + m.name}
                                    onClick={() => qty(m.id, 1)}
                                  >
                                    <Plus size={15} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="add-button"
                                  aria-label={"Add " + m.name}
                                  onClick={() =>
                                    qty(m.id, state.settings.minPax)
                                  }
                                >
                                  <Plus size={19} />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                </section>
                <section className="bottom-callout">
                  <span>✳</span>
                  <div>
                    <h2>Small details. Memorable gatherings.</h2>
                    <p>
                      Choose your date, tell us your plans, and leave the
                      cooking to us.
                    </p>
                  </div>
                  <button className="secondary" onClick={() => go("checkout")}>
                    Plan your gathering <ArrowUpRight size={16} />
                  </button>
                </section>
              </>
            )}
            {view === "checkout" && (
              <>
                <div className="page-title">
                  <div>
                    <p className="eyebrow">LET’S MAKE IT A GATHERING</p>
                    <h1>Your table, your way.</h1>
                    <p className="muted">
                      Tell us a little about your event. We’ll review and
                      confirm your request.
                    </p>
                  </div>
                </div>
                {count ? (
                  <div className="checkout-grid">
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        const f = form(e);
                        run(async () => {
                          const data = {
                            ...f,
                            pax: Number(f.pax),
                            items: items
                              .filter((m) => cart[m.id] > 0)
                              .map((m) => ({ id: m.id, qty: cart[m.id] })),
                          };
                          let order: Order;
                          if (connected) order = await api("order", data);
                          else {
                            const s = structuredClone(state);
                            order = place(s, data, uid(), token());
                            save(s);
                          }
                          setResult({ ...order, paid: 0 });
                          setCart({});
                          setView("track");
                          history.replaceState(
                            null,
                            "",
                            "#track=" + order.token,
                          );
                        });
                      }}
                    >
                      <h3>01 · Your details</h3>
                      <div className="two-col">
                        <Field label="Full name" name="name" />
                        <Field label="Phone number" name="phone" type="tel" />
                      </div>
                      <Field label="Event / delivery address" name="address" />
                      <h3>02 · The gathering</h3>
                      <div className="three-col">
                        <Field
                          label="Event date"
                          name="date"
                          type="date"
                          min={new Date(
                            Date.now() + state.settings.leadDays * 86400000,
                          )
                            .toISOString()
                            .slice(0, 10)}
                        />
                        <Field label="Serving time" name="time" type="time" />
                        <Field
                          label="Number of guests"
                          name="pax"
                          type="number"
                          min={String(state.settings.minPax)}
                          value={state.settings.minPax}
                        />
                      </div>
                      <label>
                        Dietary requests / event notes
                        <textarea
                          name="note"
                          placeholder="Let us know what would make your gathering special."
                          maxLength={1000}
                        />
                      </label>
                      <h3>03 · Payment preference</h3>
                      <div className="payment-options">
                        {[
                          ["transfer", "Bank transfer"],
                          ["qr", "QR payment"],
                          ["cash", "Cash"],
                        ].map(([v, l]) => (
                          <label key={v}>
                            <input
                              type="radio"
                              name="method"
                              value={v}
                              defaultChecked={v === "transfer"}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                      <p className="small muted">
                        This submits an order request. Your payment is not
                        collected here. You’ll receive payment instructions
                        after submitting.
                      </p>
                      <button className="primary full" disabled={busy}>
                        {busy ? "Submitting…" : "Submit order request"}
                        <ArrowRight size={17} />
                      </button>
                    </form>
                    <div className="panel cart-summary">
                      <h3>On your table</h3>
                      {items
                        .filter((m) => cart[m.id] > 0)
                        .map((m) => (
                          <div className="cart-line" key={m.id}>
                            <div>
                              <b>{m.name}</b>
                              <small>{money(m.price)} / person</small>
                              <div className="quantity">
                                <button
                                  aria-label={"Remove " + m.name}
                                  onClick={() => qty(m.id, -1)}
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  aria-label={"Quantity for " + m.name}
                                  type="number"
                                  min="0"
                                  max="10000"
                                  value={cart[m.id]}
                                  onChange={(e) =>
                                    setCart((c) => ({
                                      ...c,
                                      [m.id]: Math.max(
                                        0,
                                        Math.min(10000, Number(e.target.value)),
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  aria-label={"Add " + m.name}
                                  onClick={() => qty(m.id, 1)}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                            <b>{money(m.price * cart[m.id])}</b>
                          </div>
                        ))}
                      <div className="row between total">
                        <span>Total</span>
                        <b>{money(total)}</b>
                      </div>
                      <p className="small muted">
                        Listed menu prices only. V1 does not calculate delivery
                        fees or tax. Quantities are per item, separate from
                        guest count.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("shop")}
                      >
                        ← Continue browsing
                      </button>
                    </div>
                  </div>
                ) : (
                  <Empty
                    title="Your table is waiting"
                    text="Choose a few favourites from the menu to start your order."
                    action={() => go("shop")}
                  />
                )}
              </>
            )}
            {view === "track" && (
              <div className="narrow">
                <p className="eyebrow">FROM OUR KITCHEN TO YOUR TABLE</p>
                <h1>Your gathering, in view.</h1>
                {result ? (
                  orderCard(result)
                ) : (
                  <form
                    className="panel"
                    onSubmit={(e) => {
                      const f = form(e);
                      run(async () => {
                        if (connected)
                          setResult(
                            await api("track", { token: f.token.trim() }),
                          );
                        else {
                          const o = state.orders.find(
                            (o) => o.token === f.token.trim(),
                          );
                          if (!o)
                            throw Error(
                              "Order not found. Use your private tracking code.",
                            );
                          setResult({ ...o, paid: paid(state, o.id) });
                        }
                      });
                    }}
                  >
                    <h3>Track your order</h3>
                    <Field label="Private tracking code" name="token" />
                    <p className="muted small">
                      Use the code you received when placing your order.
                    </p>
                    <button className="primary" disabled={busy}>
                      Find my order <Search size={16} />
                    </button>
                  </form>
                )}
              </div>
            )}
            {view === "login" && (
              <div className="login-grid">
                <div className="login-intro">
                  <Leaf size={45} />
                  <h1>
                    Welcome back
                    <br />
                    to your table.
                  </h1>
                  <p>Less admin. More room for what you love.</p>
                </div>
                <form
                  className="panel"
                  onSubmit={(e) => {
                    const f = form(e);
                    run(async () => {
                      if (connected) {
                        await api("login", f);
                        await refresh(true);
                      } else if (
                        f.username !== "demo" ||
                        f.password !== "123456"
                      )
                        throw Error("Use demo / 123456 to enter the demo.");
                      setSigned(true);
                      setView("admin");
                    });
                  }}
                >
                  <p className="eyebrow">THE GATHER WORKSPACE</p>
                  <h2>Sign in</h2>
                  <Field label="Username" name="username" value="demo" />
                  <Field label="Password" name="password" type="password" />
                  <button className="primary full" disabled={busy}>
                    Open workspace <ArrowRight size={17} />
                  </button>
                  {!connected && (
                    <p className="demo-credentials">
                      Try it out: <b>demo</b> / <b>123456</b>
                      <br />
                      <small>This demo is isolated to your browser.</small>
                    </p>
                  )}
                </form>
              </div>
            )}
          </main>
          <footer>
            <a className="brand" onClick={() => go("shop")}>
              <Leaf size={22} /> gather.
            </a>
            <span>{state.settings.company} · Made for sharing.</span>
            <span>Experimental V1</span>
          </footer>
          {count > 0 && view === "shop" && (
            <div className="sticky-cart">
              <span>
                <b>{count} portions</b> · {money(total)}
              </span>
              <button onClick={() => go("checkout")}>
                Review your order <ArrowRight size={17} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
function Field({
  label,
  name,
  value,
  type = "text",
  required = true,
  ...rest
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        {...rest}
      />
    </label>
  );
}
function Stat({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="stat">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <ShoppingBag size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          Explore the menu <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
