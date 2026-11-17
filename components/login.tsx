"use client";

import { useState } from "react";
import { secretError, type Api } from "@/lib/types";
import { Tabs } from "./shell";

type Mode = "login" | "join" | "reset";

/** 로그인 · 처음 가입 · 비밀번호 재설정 */
export function LoginScreen({ api, onDone }: { api: Api; onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [secret2, setSecret2] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setErr(null); setSecret(""); setSecret2(""); setCode(""); };

  const submit = async () => {
    setErr(null);
    const n = name.trim();
    if (!n) return setErr("이름을 입력해 주세요.");
    if (mode === "join") {
      const e = secretError(secret, "pin");
      if (e) return setErr(e);
      if (secret !== secret2) return setErr("두 비밀번호가 서로 달라요.");
    }
    if (mode === "reset") {
      if (!/^\d{6}$/.test(code.trim())) return setErr("재설정 코드 6자리를 입력해 주세요.");
      if (!secret) return setErr("새 비밀번호를 입력해 주세요.");
      if (secret !== secret2) return setErr("두 비밀번호가 서로 달라요.");
    }
    setBusy(true);
    try {
      if (mode === "login") await api.login(n, secret);
      if (mode === "join") await api.register(n, secret);
      if (mode === "reset") await api.resetWithCode(n, code.trim(), secret);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pinProps = { inputMode: "numeric" as const, maxLength: 4, pattern: "\\d*" };

  return (
    <div className="shell">
      <div className="center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ego-logo.png" alt="EGO" width={800} height={140} style={{ width: 170, height: "auto" }} />
        <Tabs value={mode} onChange={switchMode} options={[
          { value: "login", label: "로그인" }, { value: "join", label: "처음 가입" }, { value: "reset", label: "재설정" },
        ]} />

        <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field">
            <label htmlFor="nm">이름</label>
            <input id="nm" className="inp" autoComplete="username" required value={name} onChange={(e) => setName(e.target.value)} placeholder="명단에 등록된 이름" />
          </div>

          {mode === "reset" && (
            <div className="field">
              <label htmlFor="cd">재설정 코드</label>
              <input id="cd" className="inp" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="운영진에게 받은 6자리" />
            </div>
          )}

          <div className="field">
            <label htmlFor="pw">{mode === "login" ? "비밀번호" : mode === "join" ? "비밀번호 (숫자 4자리)" : "새 비밀번호"}</label>
            <input id="pw" className="inp" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "join" ? "숫자 4자리" : "크루원 숫자 4자리 · 운영진 영문+숫자 8자리 이상"}
              {...(mode === "join" ? pinProps : {})} />
          </div>

          {mode !== "login" && (
            <div className="field">
              <label htmlFor="pw2">비밀번호 확인</label>
              <input id="pw2" className="inp" type="password" required value={secret2} onChange={(e) => setSecret2(e.target.value)}
                autoComplete="new-password" placeholder="한 번 더 입력" {...(mode === "join" ? pinProps : {})} />
            </div>
          )}

          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="btn" disabled={busy}>
            {busy ? "확인 중…" : mode === "login" ? "로그인" : mode === "join" ? "가입 요청" : "새 비밀번호로 로그인"}
          </button>
        </form>

        <p className="sm" style={{ margin: 0, textAlign: "center" }}>
          {mode === "login" && "비밀번호를 5번 틀리면 10분 동안 잠겨요."}
          {mode === "join" && "운영진이 명단에 등록한 이름으로만 가입할 수 있어요. 가입 후 운영진이 승인하면 이용할 수 있어요."}
          {mode === "reset" && "비밀번호를 잊었다면 운영진에게 초기화를 요청해 재설정 코드를 받으세요."}
        </p>
        {api.mode === "demo" && (
          <p className="sm" style={{ margin: 0, textAlign: "center" }}>데모: 김서준 / egorun2026 · 다른 회원 / 2580</p>
        )}
      </div>
    </div>
  );
}
