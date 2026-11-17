"use client";

/* 기기별 설정: 다크 모드, 홈 화면에 추가(PWA 설치) */

export type Theme = "light" | "dark";
const THEME_KEY = "ego-theme";

export function getTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(THEME_KEY, t); } catch { /* 저장소를 쓸 수 없어도 이번 화면에는 적용 */ }
  applyTheme(t);
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#141111" : "#FAF8F7");
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((f) => f()); });
}

export function onInstallChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  listeners.forEach((f) => f());
  return r.outcome === "accepted";
}

export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
