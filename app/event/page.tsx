"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kindLabel } from "@/lib/types";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen } from "@/components/shell";
import { MemberPicker } from "@/components/member-picker";
import { fullDateLabel, sortKo } from "@/lib/format";

/** 일정 상세: 회원은 참석자 확인, 관리자는 출석 체크 */
export default function EventPage() {
  return <Suspense><EventDetail /></Suspense>;
}

function EventDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { api, isAdmin } = useCrew();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { data, error } = useLoad(async () => {
    const [event, members, att] = await Promise.all([
      api.getEvent(id), api.listMembers(), api.listAttendance({ eventId: id }),
    ]);
    return { event, members: sortKo(members.filter((m) => m.status === "active"), (m) => m.name), att };
  }, [id]);

  useEffect(() => {
    if (data) { setChecked(new Set(data.att.map((a) => a.memberId))); setDirty(false); }
  }, [data]);

  const pick = (next: Set<string>) => { setChecked(next); setDirty(true); setMsg(null); };

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.setAttendance(id, [...checked]); setDirty(false); setMsg("출석을 저장했어요"); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm("이 일정을 삭제할까요? 출석 기록도 함께 지워져요.")) return;
    try { await api.deleteEvent(id); router.replace("/schedule"); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  if (error) return <Screen title="일정" back tab="/schedule"><ErrorText msg={error} /></Screen>;
  if (!data) return <Screen title="일정" back tab="/schedule"><Loading /></Screen>;
  if (!data.event) return <Screen title="일정" back tab="/schedule"><div className="empty">일정을 찾을 수 없어요.</div></Screen>;

  const e = data.event;
  const attendees = data.members.filter((m) => checked.has(m.id));

  return (
    <Screen title={isAdmin ? "출석 체크" : "일정"} back tab="/schedule">
      <section className="card stack" style={{ gap: 6 }}>
        <span><span className={e.kind === "run" ? "bg" : "bg gray"}>{kindLabel(e.kind)}</span></span>
        <div className="h2">{e.title}</div>
        <div className="sm">{fullDateLabel(e.date)} · 참석 {checked.size}명</div>
      </section>

      {isAdmin ? (
        <>
          <MemberPicker members={data.members} selected={checked} onChange={pick} />
          <ErrorText msg={err} />
          {msg && <p className="sm" role="status" style={{ margin: 0, textAlign: "center" }}>{msg}</p>}
          <button className="btn" disabled={!dirty || busy} onClick={save}>{busy ? "저장 중…" : "출석 저장"}</button>
          <button className="btn danger" onClick={remove}>일정 삭제</button>
        </>
      ) : (
        <section className="card tight" aria-label="참석자">
          {attendees.length === 0 && <div className="empty">아직 출석 기록이 없어요.</div>}
          {attendees.map((m) => <div className="row" key={m.id}><span>{m.name}</span></div>)}
        </section>
      )}
    </Screen>
  );
}
