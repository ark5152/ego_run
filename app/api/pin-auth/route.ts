// 로그인 요청을 Vercel 서버에서 Supabase 서버 기능(pin-auth)으로 전달.
// 브라우저가 Supabase 로 직접 요청하지 않으므로 브라우저 차단(CORS) 문제가 없고,
// 실패하면 원인 코드(404·401·5xx)를 그대로 앱에 알려 준다. 비밀번호는 저장하지 않고 전달만 한다.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const reasons: Record<number, string> = {
  401: "서버 기능의 Verify JWT 설정을 꺼 주세요",
  403: "서버 기능의 Verify JWT 설정을 꺼 주세요",
  404: "서버 기능(pin-auth)을 찾지 못했어요. 함수 주소가 pin-auth 인지 확인해 주세요",
};

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const fn = process.env.PIN_AUTH_FUNCTION || "pin-auth";
  if (!url || !key) return NextResponse.json({ ok: false, error: "Supabase 연결 설정(환경변수)이 없어요." });

  let body: string;
  try { body = await req.text(); } catch { return NextResponse.json({ ok: false, error: "요청을 읽지 못했어요." }); }
  if (body.length > 4000) return NextResponse.json({ ok: false, error: "요청이 너무 커요." });

  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  const auth = req.headers.get("authorization");
  headers.Authorization = auth && /^Bearer\s+\S+$/i.test(auth) ? auth : `Bearer ${key}`;

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/+$/, "")}/functions/v1/${fn}`, {
      method: "POST", headers, body, cache: "no-store", signal: AbortSignal.timeout(20000),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Supabase 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요. (연결 오류)" });
  }

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data && typeof data.ok === "boolean") return NextResponse.json(data);
  } catch { /* JSON 이 아니면 아래에서 원인 코드로 안내 */ }
  const reason = reasons[res.status] ?? (res.status >= 500 ? "서버 기능 실행 중 오류가 났어요" : "서버 기능 응답이 올바르지 않아요");
  return NextResponse.json({ ok: false, error: `${reason}. (코드 ${res.status})` });
}
