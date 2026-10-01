import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { admin, equal, read, session, throttle, update } from "@/lib/server";
import { mutate, paid, place } from "@/lib/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export async function GET(req: NextRequest) {
  try {
    const { state } = await read();
    if (req.nextUrl.searchParams.get("admin") === "1") {
      if (!(await admin())) return json({ error: "Please sign in." }, 401);
      return json(state);
    }
    return json({
      menus: state.menus.filter((m) => m.active),
      settings: state.settings,
    });
  } catch {
    return json(
      {
        error:
          "Database unavailable. Check server configuration and migration.",
      },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      return json({ error: "Invalid request origin." }, 403);
    if (Number(req.headers.get("content-length") ?? 0) > 20000)
      return json({ error: "Request too large." }, 413);
    const raw = await req.text();
    if (raw.length > 20000) return json({ error: "Request too large." }, 413);
    const { action, data } = JSON.parse(raw);
    if (action === "login") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      await throttle(
        "login:" + createHash("sha256").update(ip).digest("hex"),
        15,
      );
      if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_USERNAME)
        return json(
          { error: "Configure administrator credentials on the server." },
          503,
        );
      if (
        !equal(String(data.username), process.env.ADMIN_USERNAME) ||
        !equal(String(data.password), process.env.ADMIN_PASSWORD)
      )
        return json({ error: "Incorrect username or password." }, 401);
      const response = json({ ok: true });
      response.cookies.set("gather-session", session(), {
        httpOnly: true,
        secure: req.nextUrl.protocol === "https:",
        sameSite: "strict",
        path: "/",
        maxAge: 28800,
      });
      return response;
    }
    if (action === "logout") {
      const r = json({ ok: true });
      r.cookies.delete("gather-session");
      return r;
    }
    if (action === "order") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      await throttle(
        "order:" + createHash("sha256").update(ip).digest("hex"),
        30,
      );
      const id = randomUUID(),
        token = randomBytes(32).toString("hex");
      return json(await update((s) => place(s, data, id, token)));
    }
    if (action === "track") {
      if (typeof data?.token !== "string" || data.token.length !== 64)
        return json({ error: "Order not found." }, 404);
      const { state } = await read();
      const o = state.orders.find((o) => equal(o.token, data.token));
      if (!o) return json({ error: "Order not found." }, 404);
      return json({ ...o, paid: paid(state, o.id) });
    }
    if (!(await admin())) return json({ error: "Please sign in." }, 401);
    await update((s) => mutate(s, action, data));
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed.";
    return json(
      {
        error: message.startsWith("[")
          ? "Please check all form fields."
          : message,
      },
      400,
    );
  }
}
