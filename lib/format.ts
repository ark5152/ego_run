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

/** "12월 1일(화)" */
export function shortDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

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

/**
 * 숫자만 입력해도 시:분:초로 맞춰 보여줌(오른쪽부터 채움, 최대 6자리)
 * 예: "34404" → "03:44:04", "4455" → "00:44:55", 지우면 한 자리씩 오른쪽으로 당겨짐
 */
export function formatTimeDigits(input: string, prev = ""): string {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length > 6) return prev; // 6자리(시·분·초)를 넘는 입력은 무시
  if (!digits) return "";
  const p = digits.padStart(6, "0");
  return `${p.slice(0, 2)}:${p.slice(2, 4)}:${p.slice(4, 6)}`;
}

export const COURSE_LABEL = { full: "풀코스", half: "하프코스", "10k": "10K" } as const;

export function sortKo<T>(arr: T[], key: (t: T) => string): T[] {
  return [...arr].sort((a, b) => key(a).localeCompare(key(b), "ko"));
}

/**
 * 거리 인증 마감 안내: 한 달 기록은 다음 달 1일까지 인증.
 * 마감 3일 전부터 마감 당일까지만 { 인증할 월, 마감일, 남은 날 } 을 돌려주고, 그 외에는 null
 * 예) 11월 28~30일 → 11월분, 12/1 마감 / 12월 1일 → 11월분, 오늘 마감
 */
export function distanceDeadline(now: Date = new Date()): { month: string; deadline: string; daysLeft: number } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today.getDate() === 1) {
    return { month: monthStr(new Date(today.getFullYear(), today.getMonth() - 1, 1)), deadline: dateStr(today), daysLeft: 0 };
  }
  const deadline = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysLeft = Math.round((deadline.getTime() - today.getTime()) / 86400000);
  return daysLeft <= 3 ? { month: monthStr(today), deadline: dateStr(deadline), daysLeft } : null;
}
