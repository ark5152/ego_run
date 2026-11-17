"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, MonthNav, Screen, Tabs } from "@/components/shell";
import { Icon } from "@/components/icons";
import { dayLabel, monthLabel, monthRange, monthStr, shiftMonth, sortKo, todayStr } from "@/lib/format";

type Sort = "name" | "most" | "least";

export default function AttendancePage() {
  const { api, settings } = useCrew();
  const [tab, setTab] = useState<"date" | "member">("member");
  const [month, setMonth] = useState(monthStr());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("name");

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
      <MonthNav month={month} label={monthLabel(month)} onChange={(d) => setMonth(shiftMonth(month, d))} />
      <ErrorText msg={error} />
      {!data ? <Loading /> : (() => {
        const today = todayStr();
        const held = data.events.filter((e) => e.date <= today).length;
        const countOf = (id: string) => data.att.filter((a) => a.memberId === id).length;
        const kmOf = (id: string) => data.dist.filter((d) => d.memberId === id).reduce((s, d) => s + d.km, 0);
        const certified = data.members.filter((m) => kmOf(m.id) >= settings.distanceTarget).length;
        const short = data.members.filter((m) => countOf(m.id) < settings.minAttendance).length;

        if (tab === "date") {
          return (
            <section className="card tight" aria-label="날짜별 출석">
              {data.events.length === 0 && <div className="empty">이 달에는 일정이 없어요.</div>}
              {data.events.map((e) => {
                const n = data.att.filter((a) => a.eventId === e.id).length;
                return (
                  <Link key={e.id} href={`/event?id=${encodeURIComponent(e.id)}`} className="row link">
                    <span style={{ minWidth: 0 }}>
                      <span className="sm">{dayLabel(e.date)}</span><br />
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
                    <span>{m.name}{m.isLeader && <span className="tg">크루장</span>}</span>
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
