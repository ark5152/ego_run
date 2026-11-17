"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCrew } from "@/components/crew";
import { ErrorText, Screen, Tabs } from "@/components/shell";
import { todayStr } from "@/lib/format";
import { EVENT_KINDS, type EventKind } from "@/lib/types";

export default function NewEventPage() {
  return <Suspense><NewEvent /></Suspense>;
}

function NewEvent() {
  const sp = useSearchParams();
  const router = useRouter();
  const { api, isAdmin } = useCrew();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(sp.get("date") || todayStr());
  const [kind, setKind] = useState<EventKind>("run");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isAdmin) {
    return <Screen title="일정 작성" back tab="/schedule"><div className="empty">관리 권한이 있는 사람만 작성할 수 있어요</div></Screen>;
  }

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.createEvent({ title: title.trim(), date, kind });
      router.replace("/schedule");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <Screen title="일정 작성" back tab="/schedule">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="field">
          <label htmlFor="t">제목</label>
          <input id="t" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="목요 인터벌벙(러닝)" />
        </div>
        <div className="field">
          <label htmlFor="d">날짜</label>
          <input id="d" className="inp" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <span className="lbl">구분</span>
          <Tabs value={kind} onChange={setKind} options={EVENT_KINDS} />
        </div>
        <ErrorText msg={err} />
        <button className="btn" disabled={busy || !title.trim() || !date}>{busy ? "저장 중…" : "저장"}</button>
        <p className="sm" style={{ margin: 0, textAlign: "center" }}>관리 권한이 있는 사람만 작성할 수 있어요</p>
      </form>
    </Screen>
  );
}
