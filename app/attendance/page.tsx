"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, MonthNav, Screen, Tabs } from "@/components/shell";
import { Icon } from "@/components/icons";
import { dateStr, dayLabel, monthLabel, monthRange, monthStr, parseMonth, shiftMonth, sortKo, todayStr, WEEKDAYS } from "@/lib/format";
import { isStaff, kindLabel } from "@/lib/types";

type Sort = "name" | "most" | "least";

export default function AttendancePage() {
  const { api, settings } = useCrew();
  const [tab, setTab] = useState<"date" | "member">("date");
  const [month, setMonth] = useState(monthStr());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [sel, setSel] = useState(todayStr());
  const changeMonth = (d: number) => {
    const next = shiftMonth(month, d);
    setMonth(next);
    setSel(next === monthStr() ? todayStr() : `${next}-01`);
  };

  const { data, error } = useLoad(async () => {
    const { from, to } = monthRange(month);
    const [members, events, att, dist] = await Promise.all([
      api.listMembers(), api.listEvents(from, to), api.listAttendance({ from, to }),
      api.listDistance({ fromMonth: month, toMonth: month, status: "approved" }),
    ]);
    return { members: members.filter((m) => m.status === "active"), events, att, dist };
  }, [month]);

  return (
    <Screen title="출석부">
      <Tabs value={tab} onChange={setTab} options={[{ value: "date", label: "날짜별" }, { value: "member", label: "회원별" }]} />
      <MonthNav month={month} label={monthLabel(month)} onChange={changeMonth} />
      <ErrorText msg={error} />
      {!data ? <Loading /> : (() => {
        const today = todayStr();
        const held = data.events.filter((e) => e.date <= today).length;
        const countOf = (id: string) => data.att.filter((a) => a.memberId === id).length;
        const kmOf = (id: string) => data.dist.filter((d) => d.memberId === id).reduce((s, d) => s + d.km, 0);
        const certified = data.members.filter((m) => kmOf(m.id) >= settings.distanceTarget).length;
        const short = data.members.filter((m) => countOf(m.id) < settings.minAttendance).length;

        if (tab === "date") {
          const { y, m } = parseMonth(month);
          const first = new Date(y, m - 1, 1).getDay();
          const days = new Date(y, m, 0).getDate();
          // 날짜별 총 참여 인원(같은 날 여러 일정에 참석해도 1명으로 셈)
          const perDay = new Map<string, Set<string>>();
          for (const a of data.att) {
            if (!perDay.has(a.date)) perDay.set(a.date, new Set());
            perDay.get(a.date)!.add(a.memberId);
          }
          const hasEvent = new Set(data.events.map((e) => e.date));
          const dayEvents = data.events.filter((e) => e.date === sel);
          const total = data.att.length;
          return (
            <>
              <section className="card" aria-label="날짜별 출석 달력" style={{ padding: "10px 8px" }}>
                <div className="cal wk" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
                <div className="cal ac">
                  {Array.from({ length: first }, (_, i) => <span key={`b${i}`} className="blank" />)}
                  {Array.from({ length: days }, (_, i) => {
                    const ds = dateStr(new Date(y, m - 1, i + 1));
                    const n = perDay.get(ds)?.size ?? 0;
                    const cls = [hasEvent.has(ds) && "ev", ds === sel && "s", ds === today && "today"].filter(Boolean).join(" ");
                    return (
                      <button key={ds} className={cls} onClick={() => setSel(ds)} aria-pressed={ds === sel}
                        aria-label={`${m}월 ${i + 1}일, ${n ? `참여 ${n}명` : hasEvent.has(ds) ? "일정 있음" : "일정 없음"}`}>
                        <i>{i + 1}</i>
                        <small>{n > 0 ? `${n}명` : hasEvent.has(ds) ? "·" : ""}</small>
                      </button>
                    );
                  })}
                </div>
              </section>
              <p className="sm" style={{ margin: "-4px 0 0", textAlign: "right" }}>이 달 출석 {total}건 · 날짜 밑 숫자는 그날 총 참여 인원</p>

              <div className="section-title">{dayLabel(sel)}</div>
              <section className="card tight" aria-label="선택한 날의 일정">
                {dayEvents.length === 0 && <div className="empty">이 날에는 일정이 없어요.</div>}
                {dayEvents.map((e) => {
                  const n = data.att.filter((a) => a.eventId === e.id).length;
                  return (
                    <Link key={e.id} href={`/event?id=${encodeURIComponent(e.id)}`} className="row link">
                      <span style={{ minWidth: 0 }}>
                        <span className="sm">{kindLabel(e.kind)}</span><br />
                        <span>{e.title}</span>
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <b>{e.date > today && n === 0 ? "예정" : `${n}명`}</b>
                        <Icon name="right" small />
                      </span>
                    </Link>
                  );
                })}
              </section>
            </>
          );
        }

        let list = data.members.filter((m) => m.name.includes(q.trim()));
        list = sortKo(list, (m) => m.name);
        if (sort === "most") list.sort((a, b) => countOf(b.id) - countOf(a.id));
        if (sort === "least") list.sort((a, b) => countOf(a.id) - countOf(b.id));

        return (
          <>
            <div className="three">
              <div className="card"><div className="sm">모임</div><div className="v">{held}회</div></div>
              <div className="card"><div className="sm">거리 인증</div><div className="v">{certified}명</div></div>
              <div className="card"><div className="sm">참석 부족</div><div className={short ? "v warn" : "v"}>{short}명</div></div>
            </div>
            <div className="srch">
              <input className="inp" placeholder="이름 검색" aria-label="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="sort">
                <span className="sr-only">정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="name">가나다순</option>
                  <option value="most">참석 많은순</option>
                  <option value="least">참석 적은순</option>
                </select>
                <Icon name="down" small />
              </label>
            </div>
            <section className="card tight" aria-label="회원별 출석">
              {list.length === 0 && <div className="empty">회원이 없어요.</div>}
              {list.map((m) => {
                const n = countOf(m.id);
                return (
                  <div className="mr" key={m.id}>
                    <span>{m.name}{isStaff(m) && <span className="tg">운영진</span>}</span>
                    <span>{n < settings.minAttendance && <span className="bg">참석 부족</span>}</span>
                    <b>{n}회</b>
                  </div>
                );
              })}
            </section>
            <p className="sm" style={{ margin: 0 }}>
              최소 참석 {settings.minAttendance}회 · 거리 인증은 이번 달 인정 거리 {settings.distanceTarget}km 이상
            </p>
          </>
        );
      })()}
    </Screen>
  );
}
