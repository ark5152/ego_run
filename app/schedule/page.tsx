"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { badgeImage, countsAsAttendance, kindLabel, SOCIAL_PER_MONTH } from "@/lib/types";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, MonthNav, Screen, Tabs } from "@/components/shell";
import { Icon } from "@/components/icons";
import { dateStr, dayLabel, km, monthLabel, monthRange, monthStr, parseMonth, shiftMonth, todayStr, WEEKDAYS } from "@/lib/format";

export default function SchedulePage() {
  return <Suspense><Schedule /></Suspense>;
}

function Schedule() {
  const sp = useSearchParams();
  const { api, me, isAdmin } = useCrew();
  const [tab, setTab] = useState<"cal" | "rank">(sp.get("tab") === "rank" ? "rank" : "cal");
  const [month, setMonth] = useState(monthStr());
  const [sel, setSel] = useState(todayStr());
  const [period, setPeriod] = useState<"month" | "year">("month");
  const yearly = tab === "rank" && period === "year";

  const changeMonth = (d: number) => {
    const next = shiftMonth(month, d);
    setMonth(next);
    setSel(next === monthStr() ? todayStr() : `${next}-01`);
  };

  const { data, error } = useLoad(async () => {
    const { from, to } = monthRange(month);
    const { y } = parseMonth(month);
    const [members, events, yearAtt, yearDist] = await Promise.all([
      api.listMembers(), api.listEvents(from, to), api.listAttendance({ from: `${y}-01-01`, to: `${y}-12-31` }),
      api.listDistance({ fromMonth: `${y}-01`, toMonth: `${y}-12`, status: "approved" }),
    ]);
    const att = yearAtt.filter((a) => a.date >= from && a.date <= to);
    return { members: members.filter((m) => m.status === "active"), events, att, yearAtt, yearDist };
  }, [month]);

  return (
    <Screen
      title="일정"
      right={isAdmin && tab === "cal" ? (
        <Link href={`/schedule/new?date=${sel}`} className="icon-btn" aria-label="일정 작성"><Icon name="plus" /></Link>
      ) : undefined}
    >
      <Tabs value={tab} onChange={setTab} options={[{ value: "cal", label: "크루 일정" }, { value: "rank", label: "참석 랭킹" }]} />
      {tab === "rank" && <Tabs small value={period} onChange={setPeriod} options={[{ value: "month", label: "월간" }, { value: "year", label: "연간" }]} />}
      <MonthNav month={month} label={yearly ? `${parseMonth(month).y}년` : monthLabel(month)} onChange={(d) => changeMonth(yearly ? d * 12 : d)} />
      <ErrorText msg={error} />
      {!data ? <Loading /> : tab === "cal" ? (() => {
        const { y, m } = parseMonth(month);
        const first = new Date(y, m - 1, 1).getDay();
        const days = new Date(y, m, 0).getDate();
        const has = new Set(data.events.map((e) => e.date));
        const today = todayStr();
        const dayEvents = data.events.filter((e) => e.date === sel);

        const socialUsed = data.events.filter((e) => e.kind === "social").length;
        const socialLeft = Math.max(0, SOCIAL_PER_MONTH - socialUsed);

        return (
          <>
            <section className={socialLeft ? "card quota" : "card quota out"} aria-label="남은 친목 횟수">
              <div>
                <div className="h2">{m}월 남은 친목</div>
                <div className="sm">매월 {SOCIAL_PER_MONTH}회 · 이월 없음</div>
              </div>
              <b><em>{socialLeft}</em>회</b>
            </section>
            <section className="card" aria-label="달력">
              <div className="cal wk" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
              <div className="cal">
                {Array.from({ length: first }, (_, i) => <span key={`b${i}`} className="blank" />)}
                {Array.from({ length: days }, (_, i) => {
                  const ds = dateStr(new Date(y, m - 1, i + 1));
                  const cls = [has.has(ds) && "d", ds === sel && "s", ds === today && "today"].filter(Boolean).join(" ");
                  return (
                    <button key={ds} className={cls} onClick={() => setSel(ds)} aria-pressed={ds === sel}
                      aria-label={`${m}월 ${i + 1}일${has.has(ds) ? ", 일정 있음" : ""}`}>
                      <i>{i + 1}</i>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="section-title">{dayLabel(sel)}</div>
            {dayEvents.length === 0 && (
              <div className="card empty">일정이 없어요.{isAdmin && <><br /><Link href={`/schedule/new?date=${sel}`} style={{ color: "var(--accent)", fontWeight: 700 }}>+ 일정 작성</Link></>}</div>
            )}
            {dayEvents.map((e) => (
              <Link key={e.id} href={`/event?id=${encodeURIComponent(e.id)}`} className="card stack" style={{ gap: 8 }}>
                <span><span className={e.kind === "run" ? "bg" : "bg gray"}>{kindLabel(e.kind)}</span></span>
                <div className="h2">{e.title}</div>
                <div className="row" style={{ minHeight: 36, borderTop: "1px solid var(--line-soft)", borderBottom: 0 }}>
                  <span className="sm">참석</span>
                  <b>{data.att.filter((a) => a.eventId === e.id).length}명</b>
                </div>
              </Link>
            ))}
          </>
        );
      })() : (() => {
        const { y, m } = parseMonth(month);
        const att = (yearly ? data.yearAtt : data.att).filter(countsAsAttendance); // 러닝 일정만
        const dist = yearly ? data.yearDist : data.yearDist.filter((d) => d.month === month);
        const rows = data.members.map((mem) => ({
          m: mem,
          att: att.filter((a) => a.memberId === mem.id).length,
          dist: dist.filter((d) => d.memberId === mem.id).reduce((s, d) => s + d.km, 0),
        })).sort((a, b) => b.att - a.att || b.dist - a.dist || a.m.name.localeCompare(b.m.name, "ko"));

        return (
          <>
            <p className="sm" style={{ margin: 0 }}>{yearly ? `${y}년 누적 참석 · 거리` : `${m}월 참석 · 거리`} · 참석은 러닝 일정만 · 모든 회원이 조회할 수 있어요</p>
            <section className="card" style={{ paddingTop: 4, paddingBottom: 4 }} aria-label={yearly ? "연간 참석 랭킹" : "월간 참석 랭킹"}>
              <div className="rr th"><span>순위</span><span>이름</span><span>참석</span><span>{yearly ? "연간 거리" : "월간 거리"}</span></div>
              {rows.map((r, i) => (
                <div className={r.m.id === me.id ? "rr mine" : "rr"} key={r.m.id}>
                  <span className="no">{i + 1}</span>
                  <span className="rname">
                    {r.m.badgeId
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img className="px ricon" src={badgeImage(r.m.badgeId)} alt="" width={256} height={256} />
                      : <span className="ricon" aria-hidden="true" />}
                    {r.m.name}{r.m.id === me.id && <span className="tg me">나</span>}
                  </span>
                  <b>{r.att}회</b>
                  <b>{km(r.dist)}</b>
                </div>
              ))}
            </section>
          </>
        );
      })()}
    </Screen>
  );
}
