"use client";

import Link from "next/link";
import { useCrew } from "@/components/crew";
import { Screen } from "@/components/shell";
import { Icon } from "@/components/icons";

function Item({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link href={href} className="row link">
      <span>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {!!badge && <span className="bg">{badge}건</span>}
        <Icon name="right" small />
      </span>
    </Link>
  );
}

export default function MorePage() {
  const { api, me, session, isAdmin, pendingCount, reload } = useCrew();

  return (
    <Screen title="더보기">
      <section className="card">
        <div className="h2">{me.name}{me.isLeader && <span className="tg">크루장</span>}{isAdmin && <span className="tg me">관리자</span>}</div>
        <div className="sm" style={{ marginTop: 4 }}>{session.email}</div>
      </section>

      <section className="card tight">
        <Item href="/distance" label="거리 제출" />
        <Item href="/races/new" label="대회 기록 등록" />
        <Item href="/schedule?tab=rank" label="참석 랭킹" />
      </section>

      {isAdmin && (
        <>
          <div className="section-title">관리</div>
          <section className="card tight">
            <Item href="/admin/approvals" label="승인 대기" badge={pendingCount} />
            <Item href="/admin/members" label="회원 관리" />
            <Item href="/schedule/new" label="일정 작성" />
            <Item href="/admin/settings" label="크루 설정" />
          </section>
        </>
      )}

      <button className="btn ghost" onClick={async () => { await api.signOut(); await reload(); }}>로그아웃</button>
      {api.mode === "demo" && (
        <button className="btn danger" onClick={() => { try { localStorage.removeItem("ego-demo-v1"); } catch { /* */ } location.href = "/"; }}>
          데모 데이터 초기화
        </button>
      )}
    </Screen>
  );
}
