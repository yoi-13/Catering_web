import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { initial, normalizeState, type State } from "./domain";
import { cookies } from "next/headers";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw Error("Set SESSION_SECRET to at least 32 random characters.");
  return s;
};
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function session() {
  const body = `${Date.now() + 8 * 3600000}.${randomBytes(24).toString("hex")}`;
  return `${body}.${createHmac("sha256", secret()).update(body).digest("hex")}`;
}
export async function admin() {
  const c = (await cookies()).get("gather-session")?.value;
  if (!c) return false;
  const [exp, nonce, sig] = c.split(".");
  if (!exp || !nonce || !sig || Number(exp) < Date.now()) return false;
  return equal(
    sig,
    createHmac("sha256", secret()).update(`${exp}.${nonce}`).digest("hex"),
  );
}
export function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Supabase is not configured.");
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function read() {
  const { data, error } = await db()
    .from("catering_state")
    .select("data,revision")
    .eq("id", 1)
    .single();
  if (error)
    throw Error("Database unavailable. Apply the Supabase migration first.");
  return {
    state: normalizeState((data.data ?? structuredClone(initial)) as State),
    revision: data.revision as number,
  };
}
export async function update<T>(fn: (s: State) => T) {
  for (let i = 0; i < 5; i++) {
    const { state, revision } = await read();
    const result = fn(state);
    const { data, error } = await db().rpc("save_catering_state", {
      expected_revision: revision,
      new_data: state,
    });
    if (error) throw Error("Could not save changes.");
    if (data) return result;
  }
  throw Error("Another update is in progress. Please retry.");
}
export async function throttle(key: string, limit: number) {
  const { data, error } = await db().rpc("catering_rate_limit", {
    bucket_key: key,
    max_requests: limit,
  });
  if (error || !data)
    throw Error(
      "Too many requests or service unavailable. Please try again later.",
    );
}
