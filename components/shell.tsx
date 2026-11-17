"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { useCrew } from "./crew";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/attendance", label: "출석부", icon: "roll" },
  { href: "/schedule", label: "일정", icon: "cal" },
  { href: "/races", label: "대회", icon: "trophy" },
  { href: "/more", label: "더보기", icon: "menu" },
];

export function Screen({
  title, back, right, children, tab, header,
}: {
  title: string;
  /** 기본 제목 바 대신 보여줄 머리글(홈의 로고 머리글 등) */
  header?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  /** 하단 탭바에서 강조할 탭. 지정하지 않으면 경로로 추정 */
  tab?: string;
}) {
  const router = useRouter();
  return (
    <div className="shell">
      {header ?? <header className="hd">
        <div className="side">
          {back && (
            <button className="icon-btn" aria-label="뒤로" onClick={() => router.back()}>
              <Icon name="back" />
            </button>
          )}
        </div>
        <h1>{title}</h1>
        <div className="side">{right}</div>
      </header>}
      <main className="bd">{children}</main>
      <TabBar active={tab} />
    </div>
  );
}

function TabBar({ active }: { active?: string }) {
  const path = usePathname();
  const { pendingCount, isAdmin } = useCrew();
  const current = active ?? TABS.slice().reverse().find((t) => (t.href === "/" ? path === "/" : path.startsWith(t.href)))?.href ?? "/";
  return (
    <nav className="nav" aria-label="메인 메뉴">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`ni${current === t.href ? " on" : ""}`} aria-current={current === t.href ? "page" : undefined}>
          <Icon name={t.icon} />
          {t.label}
          {t.href === "/more" && isAdmin && pendingCount > 0 && (
            <span className="dot" aria-label={`승인 대기 ${pendingCount}건`}>{pendingCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function MonthNav({ month, onChange, label }: { month: string; onChange: (d: number) => void; label: string }) {
  return (
    <div className="mon">
      <button className="icon-btn" aria-label="이전 달" onClick={() => onChange(-1)}><Icon name="left" /></button>
      <b>{label}</b>
      <button className="icon-btn" aria-label="다음 달" onClick={() => onChange(1)}><Icon name="right" /></button>
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange, small }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div className={small ? "tabs sg" : "tabs"} role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return <div className="spin">불러오는 중…</div>;
}

export function ErrorText({ msg }: { msg: string | null }) {
  return msg ? <p className="err" role="alert">{msg}</p> : null;
}

/** 홈 상단: 크루 로고 + 내 이름 배지 */
export function BrandHeader() {
  const { me } = useCrew();
  return (
    <header className="brand">
      <img className="brand-logo" src="/ego-logo.png" alt="EGO" width={800} height={140} />
      <Link href="/more" className="me-chip" aria-label={`내 정보: ${me.name}`}>
        <span className="av" aria-hidden="true">{me.name.slice(-2)}</span>
        <span className="nm">{me.name}</span>
      </Link>
    </header>
  );
}
