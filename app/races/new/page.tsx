"use client";

import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Screen, Tabs } from "@/components/shell";
import { Icon } from "@/components/icons";
import { COURSE_LABEL, formatTimeDigits, hms, parseHms, todayStr } from "@/lib/format";
import type { Course } from "@/lib/types";

export default function NewRacePage() {
  const { api, me } = useCrew();
  const [course, setCourse] = useState<Course>("full");
  const [time, setTime] = useState("");
  const [raceName, setRaceName] = useState("");
  const [raceDate, setRaceDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = useLoad(() => api.listRaceRecords({ memberId: me.id }), [me.id]);
  const seconds = parseHms(time);

  const save = async () => {
    if (!seconds) return setErr("기록을 확인해 주세요. 분과 초는 59까지예요 (예: 34404 → 03:44:04)");
    setBusy(true); setErr(null);
    try {
      await api.addRaceRecord({ course, seconds, raceName: raceName.trim(), raceDate });
      setTime(""); setRaceName("");
      mine.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("이 기록을 삭제할까요?")) return;
    try { await api.deleteRaceRecord(id); mine.reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const records = [...(mine.data ?? [])].sort((a, b) => b.raceDate.localeCompare(a.raceDate));

  return (
    <Screen title="대회 기록 등록" back tab="/races">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="field">
          <span className="lbl">종목</span>
          <Tabs value={course} onChange={setCourse} options={[
            { value: "full", label: "풀코스" }, { value: "half", label: "하프" }, { value: "10k", label: "10K" },
          ]} />
        </div>
        <div className="field">
          <label htmlFor="tm">기록 (숫자만 입력하면 시:분:초로 바뀌어요)</label>
          <input id="tm" className="inp" inputMode="numeric" required placeholder="예: 34404 → 03:44:04" autoComplete="off"
            value={time} onChange={(e) => setTime(formatTimeDigits(e.target.value, time))} style={{ fontVariantNumeric: "tabular-nums" }} />
        </div>
        <div className="field">
          <label htmlFor="rn">대회명</label>
          <input id="rn" className="inp" required placeholder="춘천마라톤" value={raceName} onChange={(e) => setRaceName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rd">대회 날짜</label>
          <input id="rd" className="inp" type="date" required value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
        </div>
        <ErrorText msg={err} />
        <button className="btn" disabled={busy || !time || !raceName.trim()}>{busy ? "저장 중…" : "기록 저장"}</button>
      </form>

      <div className="section-title">내 대회 기록</div>
      <section className="card tight">
        {records.length === 0 && <div className="empty">아직 등록한 기록이 없어요.</div>}
        {records.map((r) => (
          <div className="row" key={r.id}>
            <span style={{ minWidth: 0 }}>
              <span>{COURSE_LABEL[r.course]} <b style={{ fontVariantNumeric: "tabular-nums" }}>{hms(r.seconds)}</b></span><br />
              <span className="sm">{r.raceName} · {r.raceDate}</span>
            </span>
            <button className="icon-btn" aria-label={`${r.raceName} 기록 삭제`} onClick={() => remove(r.id)}><Icon name="trash" /></button>
          </div>
        ))}
      </section>
    </Screen>
  );
}
