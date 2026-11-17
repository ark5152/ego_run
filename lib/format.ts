const pad = (n: number) => String(n).padStart(2, "0");

/** 로컬(한국) 기준 YYYY-MM-DD */
export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return dateStr(new Date());
}

/** YYYY-MM */
export function monthStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseMonth(ym: string): { y: number; m: number } {
  const [y, m] = ym.split("-").map(Number);
  return { y, m };
}

export function shiftMonth(ym: string, delta: number): string {
  const { y, m } = parseMonth(ym);
  return monthStr(new Date(y, m - 1 + delta, 1));
}

export function monthRange(ym: string): { from: string; to: string } {
  const { y, m } = parseMonth(ym);
  return { from: dateStr(new Date(y, m - 1, 1)), to: dateStr(new Date(y, m, 0)) };
}

export function monthLabel(ym: string): string {
  const { y, m } = parseMonth(ym);
  return `${y}년 ${m}월`;
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${m}월 ${d}일 ${WEEK[w]}요일`;
}

export function fullDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return `${y}년 ${m}월 ${d}일 (${WEEK[w]})`;
}

export const WEEKDAYS = WEEK;

export function km(n: number): string {
  return `${(Math.round(n * 10) / 10).toFixed(1)}km`;
}

export function hms(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "3:07:45" / "03:07:45" / "38:41" → 초. 잘못된 형식이면 null */
export function parseHms(text: string): number | null {
  const parts = text.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,2}$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m > 59 || s > 59) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

export const COURSE_LABEL = { full: "풀코스", half: "하프코스", "10k": "10K" } as const;

export function sortKo<T>(arr: T[], key: (t: T) => string): T[] {
  return [...arr].sort((a, b) => key(a).localeCompare(key(b), "ko"));
}
