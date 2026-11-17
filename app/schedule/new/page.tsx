"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCrew, useLoad } from "@/components/crew";
import { MemberPicker } from "@/components/member-picker";
import { ErrorText, Screen, Tabs } from "@/components/shell";
import { monthRange, parseMonth, todayStr } from "@/lib/format";
import { EVENT_KINDS, SOCIAL_PER_MONTH, type EventKind } from "@/lib/types";

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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const month = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : todayStr().slice(0, 7);
  const { data } = useLoad(async () => {
    const { from, to } = monthRange(month);
    const [members, events] = await Promise.all([api.listMembers(), api.listEvents(from, to)]);
    return { members: members.filter((m) => m.status === "active"), socialUsed: events.filter((e) => e.kind === "social").length };
  }, [month]);

  if (!isAdmin) {
    return <Screen title="일정 작성" back tab="/schedule"><div className="empty">운영진만 작성할 수 있어요</div></Screen>;
  }

  const socialLeft = data ? Math.max(0, SOCIAL_PER_MONTH - data.socialUsed) : null;
  const socialBlocked = kind === "social" && socialLeft === 0;

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api.createEvent({ title: title.trim(), date, kind }, [...picked]);
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
          {kind === "social" && socialLeft !== null && (
            <span className={socialBlocked ? "err" : "sm"}>
              {socialBlocked
                ? `${parseMonth(month).m}월 친목 ${SOCIAL_PER_MONTH}회를 모두 사용했어요. 다음 달에 새로 3회가 생겨요.`
                : `${parseMonth(month).m}월 남은 친목 ${socialLeft}회 · 저장하면 1회 차감돼요`}
            </span>
          )}
        </div>

        {data && <MemberPicker members={data.members} selected={picked} onChange={setPicked} />}

        <ErrorText msg={err} />
        <button className="btn" disabled={busy || !title.trim() || !date || socialBlocked}>
          {busy ? "저장 중…" : picked.size ? `저장 · 참석 ${picked.size}명` : "저장"}
        </button>
        <p className="sm" style={{ margin: 0, textAlign: "center" }}>참석자는 나중에 일정에서 다시 고칠 수 있어요</p>
      </form>
    </Screen>
  );
}
