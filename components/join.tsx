"use client";

import { useEffect, useState } from "react";
import type { Api, Member } from "@/lib/types";
import { sortKo } from "@/lib/format";

/** 가입 요청: 운영진이 미리 등록한 명단에서 내 이름을 고른다 */
export function JoinScreen({ api, onDone }: { api: Api; onDone: () => void }) {
  const [list, setList] = useState<Member[] | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listMembers()
      .then((ms) => setList(sortKo(ms.filter((m) => m.status === "unclaimed"), (m) => m.name)))
      .catch((e) => setErr(e.message));
  }, [api]);

  const shown = (list ?? []).filter((m) => m.name.includes(q.trim()));

  const submit = async () => {
    if (!pick) return;
    setBusy(true); setErr(null);
    try { await api.requestJoin(pick); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div className="shell">
      <header className="hd"><div /><h1>가입 요청</h1><div /></header>
      <main className="bd">
        <div>
          <h2 className="h2">내 이름을 선택해 주세요</h2>
          <p className="sm" style={{ margin: "6px 0 0" }}>운영진이 승인하면 가입이 완료돼요.</p>
        </div>
        <input className="inp" placeholder="이름 검색" aria-label="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="card tight" role="radiogroup" aria-label="이름">
          {list === null && !err && <div className="empty">불러오는 중…</div>}
          {list !== null && shown.length === 0 && (
            <div className="empty">선택할 수 있는 이름이 없어요.<br />크루 운영진에게 명단 등록을 요청하세요.</div>
          )}
          {shown.map((m) => (
            <button key={m.id} type="button" role="radio" className="rd" aria-checked={pick === m.id} onClick={() => setPick(m.id)}>
              <i /><span>{m.name}</span>
            </button>
          ))}
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" disabled={!pick || busy} onClick={submit}>{busy ? "요청 중…" : "승인 요청"}</button>
        <button className="btn ghost" onClick={async () => { await api.signOut(); onDone(); }}>로그아웃</button>
      </main>
    </div>
  );
}

export function PendingScreen({ api, me, onDone }: { api: Api; me: Member; onDone: () => void }) {
  return (
    <div className="shell">
      <div className="center">
        <div className="logo">승인 대기 중</div>
        <p style={{ margin: 0 }}><b>{me.name}</b> 님의 가입 요청을 보냈어요.<br />운영진이 승인하면 바로 이용할 수 있어요.</p>
        <button className="btn" onClick={onDone}>새로고침</button>
        <button className="btn ghost" onClick={async () => { await api.cancelJoin(); onDone(); }}>요청 취소 (이름 다시 선택)</button>
      </div>
    </div>
  );
}
