"use client";

import { useState } from "react";
import type { Api } from "@/lib/types";

export function LoginScreen({ api, onDone }: { api: Api; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="shell">
      <div className="center">
        <div className="logo">EGO RUNNING CREW</div>
        <p className="sm" style={{ margin: 0 }}>이메일로 받은 인증 코드로 로그인해요.</p>

        {!sent ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.sendLoginCode(email.trim()); setSent(true); }); }}>
            <div className="field">
              <label htmlFor="email">이메일</label>
              <input id="email" className="inp" type="email" inputMode="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <button className="btn" disabled={busy || !email}>{busy ? "보내는 중…" : "인증 코드 받기"}</button>
          </form>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.verifyLoginCode(email.trim(), code.trim()); onDone(); }); }}>
            <p className="sm" style={{ margin: 0 }}><b style={{ color: "var(--ink)" }}>{email}</b> 로 코드를 보냈어요. 메일의 링크를 눌러도 돼요.</p>
            <div className="field">
              <label htmlFor="code">인증 코드</label>
              <input id="code" className="inp" inputMode="numeric" autoComplete="one-time-code" required
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="6자리 숫자" />
            </div>
            <button className="btn" disabled={busy || !code}>{busy ? "확인 중…" : "로그인"}</button>
            <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(""); }}>이메일 다시 입력</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </div>
  );
}
