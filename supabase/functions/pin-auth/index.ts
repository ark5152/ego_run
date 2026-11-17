// EGO 러닝크루: 이름 + 비밀번호 로그인 (Supabase Edge Function "pin-auth")
//
// 비밀번호 확인·잠금은 DB 함수(auth_login 등)가 하고, 이 함수는 서버 키로 그 함수를 부른 뒤
// 성공하면 로그인 세션을 만들어 돌려줍니다. 서버 키는 이 함수 안에서만 쓰이고 앱으로 나가지 않습니다.
//
// 요청(JSON):  { action: "login" | "register" | "reset" | "change", name?, secret?, code?, current? }
// 응답(JSON):  { ok: true, session?: { access_token, refresh_token } } 또는 { ok: false, error }

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

/** 키 읽기: 예전 방식(SUPABASE_SERVICE_ROLE_KEY)과 새 방식(SUPABASE_SECRET_KEYS, JSON) 모두 지원 */
function envKey(legacy: string, modern: string): string {
  const v = Deno.env.get(legacy);
  if (v) return v;
  const raw = Deno.env.get(modern);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    const first = Object.values(parsed as Record<string, unknown>).find((x) => typeof x === "string");
    return (first as string) ?? "";
  } catch {
    return raw;
  }
}

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
const ANON = envKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
const CONFIG_OK = Boolean(URL && SERVICE && ANON);

// 키가 없어도 함수가 멈추지 않도록(멈추면 앱에는 '연결 실패'로만 보임) 필요할 때 만든다
let adminClient: SupabaseClient | null = null;
const admin = () =>
  (adminClient ??= createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } }));

const corsFor = (req: Request) => ({
  "Access-Control-Allow-Origin": "*",
  // 브라우저가 보내겠다고 한 헤더를 그대로 허용(supabase-js 버전에 따라 헤더가 달라도 막히지 않게)
  "Access-Control-Allow-Headers":
    req.headers.get("Access-Control-Request-Headers") ?? "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
});
let cors: Record<string, string> = {};
const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string) => reply({ ok: false, error });

/** 사용자마다 다른 내부 로그인 키(서버 키로 만든 HMAC). 회원은 이 값을 알 필요도, 볼 수도 없음 */
async function internalPassword(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("ego-pin:" + userId)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

/** 비밀번호 확인을 통과한 사용자의 세션 발급 */
async function sessionFor(userId: string) {
  const { data: u, error } = await admin().auth.admin.getUserById(userId);
  if (error || !u.user?.email) throw new Error("로그인 정보를 찾을 수 없어요. 운영진에게 문의해 주세요.");
  const password = await internalPassword(userId);
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  let r = await client.auth.signInWithPassword({ email: u.user.email, password });
  if (r.error) {
    // 서버 키가 바뀌었거나 처음인 경우: 내부 키를 다시 맞추고 한 번 더
    await admin().auth.admin.updateUserById(userId, { password });
    r = await client.auth.signInWithPassword({ email: u.user.email, password });
  }
  if (r.error || !r.data.session) throw new Error("로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
  return { access_token: r.data.session.access_token, refresh_token: r.data.session.refresh_token };
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as { ok: boolean; error?: string; user_id?: string };
}

const str = (v: unknown, max = 100) => (typeof v === "string" ? v.slice(0, max) : "");

Deno.serve(async (req) => {
  cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("지원하지 않는 요청이에요.");
  if (!CONFIG_OK) {
    console.error("pin-auth: SUPABASE_URL / 서버 키 / 공개 키 환경변수를 찾지 못함");
    return fail("서버 설정이 아직 끝나지 않았어요. (pin-auth 키 설정 확인 필요)");
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = str(body.action, 20);
    const name = str(body.name, 40).trim();
    const secret = str(body.secret, 72);

    if (action === "login") {
      if (!name || !secret) return fail("이름과 비밀번호를 입력해 주세요.");
      const r = await rpc("auth_login", { p_name: name, p_secret: secret });
      if (!r.ok) return fail(r.error ?? "로그인에 실패했어요.");
      return reply({ ok: true, session: await sessionFor(r.user_id!) });
    }

    if (action === "register") {
      if (!name || !secret) return fail("이름과 비밀번호를 입력해 주세요.");
      // 이메일은 보내지 않는 내부용 주소(회원에게 보이지 않음)
      const email = `${crypto.randomUUID()}@members.ego-crew.local`;
      const { data: created, error } = await admin().auth.admin.createUser({
        email, email_confirm: true, password: crypto.randomUUID() + "Aa1!",
      });
      if (error || !created.user) return fail("가입에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
      const userId = created.user.id;
      let r;
      try { r = await rpc("auth_register", { p_name: name, p_pin: secret, p_user_id: userId }); }
      catch (e) { await admin().auth.admin.deleteUser(userId); throw e; }
      if (!r.ok) { await admin().auth.admin.deleteUser(userId); return fail(r.error ?? "가입에 실패했어요."); }
      return reply({ ok: true, session: await sessionFor(userId) });
    }

    if (action === "reset") {
      const code = str(body.code, 10).trim();
      if (!name || !code || !secret) return fail("이름, 재설정 코드, 새 비밀번호를 모두 입력해 주세요.");
      const r = await rpc("auth_reset", { p_name: name, p_code: code, p_secret: secret });
      if (!r.ok) return fail(r.error ?? "재설정에 실패했어요.");
      return reply({ ok: true, session: await sessionFor(r.user_id!) });
    }

    if (action === "change") {
      // 로그인한 본인만: 앱이 보낸 로그인 토큰으로 누구인지 확인
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who } = await admin().auth.getUser(token);
      if (!who.user) return fail("다시 로그인해 주세요.");
      const r = await rpc("auth_change", { p_user_id: who.user.id, p_current: str(body.current, 72), p_secret: secret });
      if (!r.ok) return fail(r.error ?? "변경에 실패했어요.");
      return reply({ ok: true });
    }

    return fail("지원하지 않는 요청이에요.");
  } catch (e) {
    console.error(e);
    return fail("서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요.");
  }
});
