"use client";

import { useState } from "react";
import { useCrew } from "@/components/crew";
import { ErrorText, Screen } from "@/components/shell";

export default function SettingsPage() {
  const { api, isAdmin, settings, reload } = useCrew();
  const [minAtt, setMinAtt] = useState(String(settings.minAttendance));
  const [target, setTarget] = useState(String(settings.distanceTarget));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isAdmin) return <Screen title="크루 설정" back tab="/more"><div className="empty">관리자만 볼 수 있어요</div></Screen>;

  const a = Number(minAtt), t = Number(target);
  const valid = Number.isInteger(a) && a >= 0 && a <= 31 && Number.isFinite(t) && t >= 0 && t < 10000 && minAtt !== "" && target !== "";

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { await api.updateSettings({ minAttendance: a, distanceTarget: t }); await reload(); setMsg("저장했어요"); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen title="크루 설정" back tab="/more">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="field">
          <label htmlFor="a">월 최소 참석 횟수</label>
          <input id="a" className="inp" inputMode="numeric" value={minAtt} onChange={(e) => setMinAtt(e.target.value.replace(/\D/g, ""))} />
          <span className="sm">이보다 적으면 출석부에 ‘참석 부족’으로 표시돼요. 초과 참석은 횟수에만 반영돼요.</span>
        </div>
        <div className="field">
          <label htmlFor="t">월 거리 인증 목표 (km)</label>
          <input id="t" className="inp" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        <ErrorText msg={err} />
        {msg && <p className="sm" role="status" style={{ margin: 0, textAlign: "center" }}>{msg}</p>}
        <button className="btn" disabled={!valid || busy}>{busy ? "저장 중…" : "저장"}</button>
      </form>
    </Screen>
  );
}
