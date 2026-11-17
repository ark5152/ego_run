"use client";

import { useState } from "react";
import { secretError, type Api, type Member } from "@/lib/types";

/** 가입 요청 후 운영진 승인을 기다리는 화면 */
export function PendingScreen({ api, me, onDone }: { api: Api; me: Member; onDone: () => void }) {
  return (
    <div className="shell">
      <div className="center">
        <div className="logo">승인 대기 중</div>
        <p style={{ margin: 0 }}><b>{me.name}</b> 님의 가입 요청을 보냈어요.<br />운영진이 승인하면 바로 이용할 수 있어요.</p>
        <button className="btn" onClick={onDone}>새로고침</button>
        <button className="btn ghost" onClick={async () => { await api.cancelJoin(); await api.signOut(); onDone(); }}>
          요청 취소 (다른 이름으로 다시 가입)
        </button>
        <button className="btn ghost" onClick={async () => { await api.signOut(); onDone(); }}>로그아웃</button>
      </div>
    </div>
  );
}

/** 로그인은 됐지만 명단과 연결이 끊긴 경우(반려·명단 삭제) */
export function NoMemberScreen({ api, onDone }: { api: Api; onDone: () => void }) {
  return (
    <div className="shell">
      <div className="center">
        <div className="logo">가입 정보 없음</div>
        <p style={{ margin: 0 }}>가입이 반려됐거나 명단에서 빠졌어요.<br />운영진에게 확인한 뒤 다시 가입해 주세요.</p>
        <button className="btn" onClick={async () => { await api.signOut(); onDone(); }}>처음 화면으로</button>
      </div>
    </div>
  );
}

/** 비밀번호 변경 폼. 운영진은 영문+숫자 8자리 이상, 크루원은 숫자 4자리 */
export function ChangeSecretForm({ api, staff, onDone, submitLabel = "비밀번호 변경" }: {
  api: Api; staff: boolean; onDone: () => void; submitLabel?: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const kind = staff ? "password" : "pin";
  const pinProps = staff ? {} : { inputMode: "numeric" as const, maxLength: 4 };

  const submit = async () => {
    setErr(null);
    const e = secretError(next, kind);
    if (e) return setErr(e);
    if (next !== next2) return setErr("두 비밀번호가 서로 달라요.");
    setBusy(true);
    try { await api.changeSecret(current, next); onDone(); }
    catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
    finally { setBusy(false); }
  };

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="field">
        <label htmlFor="cur">지금 비밀번호</label>
        <input id="cur" className="inp" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nx">새 비밀번호 {staff ? "(영문+숫자 8자리 이상)" : "(숫자 4자리)"}</label>
        <input id="nx" className="inp" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} {...pinProps} />
      </div>
      <div className="field">
        <label htmlFor="nx2">새 비밀번호 확인</label>
        <input id="nx2" className="inp" type="password" autoComplete="new-password" required value={next2} onChange={(e) => setNext2(e.target.value)} {...pinProps} />
      </div>
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="btn" disabled={busy}>{busy ? "저장 중…" : submitLabel}</button>
    </form>
  );
}

/** 운영진으로 지정됐지만 아직 4자리 비밀번호인 경우: 영문+숫자 비밀번호로 바꿔야 운영진 기능이 열림 */
export function StaffUpgradeScreen({ api, me, onDone }: { api: Api; me: Member; onDone: () => void }) {
  return (
    <div className="shell">
      <main className="bd" style={{ paddingTop: "calc(env(safe-area-inset-top) + 32px)" }}>
        <div>
          <h1 className="h2" style={{ fontSize: 20 }}>{me.name} 님, 운영진이 되셨어요</h1>
          <p className="sm" style={{ margin: "6px 0 0" }}>
            운영진 계정은 보안을 위해 <b>영문과 숫자를 섞은 8자리 이상</b> 비밀번호가 필요해요.
            바꾸면 바로 운영진 기능을 쓸 수 있어요.
          </p>
        </div>
        <ChangeSecretForm api={api} staff onDone={onDone} submitLabel="운영진 비밀번호 설정" />
        <button className="btn ghost" onClick={async () => { await api.signOut(); onDone(); }}>로그아웃</button>
      </main>
    </div>
  );
}
