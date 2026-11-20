"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCrew } from "@/components/crew";
import { Screen } from "@/components/shell";
import { Icon } from "@/components/icons";
import {
  canPromptInstall, getTheme, isInstalled, isIos, onInstallChange, promptInstall, setTheme, type Theme,
} from "@/components/device";
import { isStaff } from "@/lib/types";

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
  const { api, me, isAdmin, pendingCount, settings, reload } = useCrew();
  const [theme, setThemeState] = useState<Theme>("light");
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
    const sync = () => { setInstalled(isInstalled()); setCanPrompt(canPromptInstall()); };
    sync();
    return onInstallChange(sync);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  const install = async () => {
    if (canPrompt) { await promptInstall(); setInstalled(isInstalled()); return; }
    setGuide((g) => !g);
  };

  const insta = settings.instagram.trim();

  return (
    <Screen title="더보기">
      <section className="card">
        <div className="h2">{me.name}{isStaff(me) && <span className="tg me">운영진</span>}</div>
        <div className="sm" style={{ marginTop: 4 }}>{isStaff(me) ? "운영진" : "크루원"} · EGO 러닝크루</div>
      </section>

      <section className="card tight">
        <button type="button" className="row link plain" onClick={install} aria-expanded={!canPrompt ? guide : undefined}>
          <span>홈 화면에 추가</span>
          <span className="sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {installed ? "설치됨" : canPrompt ? "설치하기" : ""}
            <Icon name={guide ? "down" : "right"} small />
          </span>
        </button>
        {guide && (
          <div className="guide">
            {installed && <p>이미 홈 화면에서 앱으로 실행 중이에요.</p>}
            {(!installed && isIos()) ? (
              <ol>
                <li>Safari 아래쪽의 <b>공유</b> 버튼을 누르세요.</li>
                <li><b>홈 화면에 추가</b>를 누르세요.</li>
                <li>오른쪽 위 <b>추가</b>를 누르면 끝!</li>
              </ol>
            ) : !installed && (
              <ol>
                <li>Chrome 오른쪽 위 <b>⋮</b> 메뉴를 누르세요.</li>
                <li><b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.</li>
                <li><b>설치</b>를 누르면 홈 화면에 EGO 아이콘이 생겨요.</li>
              </ol>
            )}
          </div>
        )}

        {insta ? (
          <a className="row link" href={`https://www.instagram.com/${encodeURIComponent(insta)}/`} target="_blank" rel="noopener noreferrer">
            <span>인스타그램</span>
            <span className="sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>@{insta}<Icon name="right" small /></span>
          </a>
        ) : (
          <div className="row">
            <span>인스타그램</span>
            {isAdmin
              ? <Link href="/admin/settings" className="sm" style={{ color: "var(--accent)", fontWeight: 700 }}>계정 등록하기</Link>
              : <span className="sm">아직 등록되지 않았어요</span>}
          </div>
        )}

        <Item href="/badges" label="아이콘 선택" />
        <Item href="/notices" label="공지사항" />
        <Item href="/password" label="비밀번호 변경" />

        <button type="button" className="row link plain" role="switch" aria-checked={theme === "dark"} onClick={toggleTheme}>
          <span>다크 모드</span>
          <span className="sw" aria-hidden="true"><i /></span>
        </button>
      </section>

      {isAdmin && (
        <>
          <div className="section-title">관리</div>
          <section className="card tight">
            <Item href="/admin/approvals" label="승인 · 거리 인증 관리" badge={pendingCount} />
            <Item href="/admin/members" label="회원 관리" />
            <Item href="/schedule/new" label="일정 작성" />
            <Item href="/notices" label="공지 작성" />
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
