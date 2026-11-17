import type { Api } from "../types";
import { createSupabaseApi } from "./supabase";
import { createMockApi } from "./mock";

let api: Api | null = null;

/** Supabase 환경변수가 있으면 실제 백엔드, 없으면 데모 모드 */
export function getApi(): Api {
  if (api) return api;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  api = url && key ? createSupabaseApi(url, key) : createMockApi();
  return api;
}
