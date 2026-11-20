import type { Api } from "../types";
import { createSupabaseApi } from "./supabase";
import { createMockApi } from "./mock";

let api: Api | null = null;

const DEMO_FLAG = "ego-demo-mode";

/** 주소에 ?demo=1 을 붙이면 이 기기에서 데모로 보기(?demo=0 이나 '데모 종료'로 돌아감). 실제 데이터와 섞이지 않음 */
function demoRequested(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") localStorage.setItem(DEMO_FLAG, "1");
    if (q === "0") localStorage.removeItem(DEMO_FLAG);
    return localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export function exitDemo() {
  try { localStorage.removeItem(DEMO_FLAG); } catch { /* */ }
  window.location.href = "/";
}

/** Supabase 환경변수가 있으면 실제 백엔드, 없거나 데모를 요청하면 데모 모드 */
export function getApi(): Api {
  if (api) return api;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  api = url && key && !demoRequested() ? createSupabaseApi(url, key) : createMockApi();
  return api;
}

/** 실제 서버가 연결된 배포에서 데모로 보고 있는지(데모 종료 버튼 표시용) */
export const canExitDemo = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
