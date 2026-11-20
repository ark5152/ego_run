"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { BrandHeader, ErrorText, Loading, Screen, Tabs } from "@/components/shell";
import { distanceDeadline, shortDayLabel, hms, km, monthStr, parseMonth } from "@/lib/format";
import { countsAsAttendance } from "@/lib/types";
import { AdminDashboard } from "@/components/admin-dashboard";

export default function HomePage() {
  const { api, me, settings, isAdmin } = useCrew();
  const month = monthStr();
  const [period, setPeriod] = useState<"month" | "year">("month");

  const { data, error } = useLoad(async () => {
    const [att, dist, races] = await Promise.all([
      api.listAttendance({ memberId: me.id }),
      api.listDistance({ memberId: me.id }),
      api.listRaceRecords({ memberId: me.id }),
    ]);
    return { att, dist, races };
  }, [me.id]);

  return (
    <Screen title="홈" header={<BrandHeader />}>
      <section className="hero" aria-label="EGO">
        <p>Everyday GO</p>
        <p>Everyone GO</p>
        <p>Everywhere GO</p>
      </section>
      {isAdmin && <AdminDashboard />}
      <ErrorText msg={error} />
      {!data ? <Loading /> : (() => {
        const approved = data.dist.filter((d) => d.status === "approved");
        const runAtt = data.att.filter(countsAsAttendance); // 출석 횟수는 '러닝' 일정만
        const attIn = (prefix: string) => runAtt.filter((a) => a.date.startsWith(prefix)).length;
        const distIn = (prefix: string) => approved.filter((d) => d.month.startsWith(prefix)).reduce((s, d) => s + d.km, 0);
        const { y, m: curM } = parseMonth(month);
        const yearMonths = Array.from({ length: curM }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`).reverse();
        const km1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
        const pendingKm = data.dist.filter((d) => d.status === "pending" && d.month === month).reduce((s, d) => s + d.km, 0);

        const attNow = attIn(month);
        const distNow = distIn(month);
        const pct = (v: number, goal: number) => (goal <= 0 ? 100 : Math.min(100, (v / goal) * 100));
        const best = (c: "full" | "half" | "10k") => {
          const rs = data.races.filter((r) => r.course === c);
          return rs.length ? Math.min(...rs.map((r) => r.seconds)) : null;
        };

        // 마감 3일 전부터, 해당 월을 아직 제출하지 않았으면(반려만 있으면 미제출로 봄) 붉은 안내
        const due = distanceDeadline();
        const dueMissing = due && !data.dist.some((d) => d.month === due.month && d.status !== "rejected");

        return (
          <>
            {due && dueMissing && (
              <section className="deadline" role="alert" aria-label="거리 인증 마감 안내">
                <span>
                  {parseMonth(due.month).m}월 거리 인증은 {shortDayLabel(due.deadline)}까지입니다
                  <small>{due.daysLeft === 0 ? "오늘이 마감이에요!" : `마감까지 ${due.daysLeft}일 남았어요`} · 아직 인증하지 않았어요</small>
                </span>
                <Link href="/distance" className="btn">인증하기</Link>
              </section>
            )}
            <section className="card stack" aria-label="이번 달 현황">
              <h2 className="h2">이번 달 현황</h2>
              <div className="two">
                <div>
                  <div className="sm">참석</div>
                  <div className="big"><em>{attNow}</em><small> / {settings.minAttendance}회</small></div>
                  <div className="bar"><i style={{ width: `${pct(attNow, settings.minAttendance)}%` }} /></div>
                </div>
                <div>
                  <div className="sm">거리 인증</div>
                  <div className="big"><em>{distNow > 0 ? (Math.round(distNow * 10) / 10).toFixed(1) : "—"}</em><small> / {settings.distanceTarget}km</small></div>
                  <div className="bar"><i style={{ width: `${pct(distNow, settings.distanceTarget)}%` }} /></div>
                </div>
              </div>
              <Link href="/distance" className="btn">거리 제출</Link>
              <div className="sm" style={{ textAlign: "center" }}>
                {pendingKm > 0 ? `${km(pendingKm)} 검토 중 · ` : ""}운영진이 인정하면 반영돼요
              </div>
            </section>

            <div className="flt" style={{ marginTop: 10, marginBottom: -4 }}>
              <div className="section-title" style={{ margin: 0 }}>내 기록</div>
              <Tabs small value={period} onChange={setPeriod} options={[{ value: "month", label: `${curM}월` }, { value: "year", label: `${y}년` }]} />
            </div>
            <section className="card" aria-label={period === "month" ? "이번 달 내 기록" : "올해 내 기록"}>
              <div className="two">
                <div>
                  <div className="sm">{period === "month" ? `${curM}월 출석` : `${y}년 출석`}</div>
                  <div className="big">{period === "month" ? attIn(month) : attIn(`${y}-`)}<small>회</small></div>
                </div>
                <div>
                  <div className="sm">{period === "month" ? `${curM}월 누적 거리` : `${y}년 누적 거리`}</div>
                  <div className="big">{km1(period === "month" ? distIn(month) : distIn(`${y}-`))}<small>km</small></div>
                </div>
              </div>
              {period === "year" && (
                <>
                  <div className="tb th"><span>월별</span><span>출석</span><span>거리</span></div>
                  {yearMonths.map((ym) => {
                    const d = distIn(ym);
                    return (
                      <div className="tb" key={ym}>
                        <span>{parseMonth(ym).m}월</span><span>{attIn(ym)}회</span><span>{d > 0 ? km(d) : "—"}</span>
                      </div>
                    );
                  })}
                </>
              )}
              <p className="sm" style={{ margin: "10px 0 0" }}>출석은 ‘러닝’ 일정만, 거리는 운영진이 인정한 기록만 세요</p>
            </section>

            <div className="section-title">최고기록</div>
            <section className="card tight" aria-label="최고기록">
              {(["full", "half", "10k"] as const).map((c) => {
                const b = best(c);
                return (
                  <div className="row" key={c}>
                    <span>{c === "full" ? "풀코스" : c === "half" ? "하프코스" : "10K"}</span>
                    <b className="big" style={{ fontSize: 22 }}>{b ? hms(b) : "—"}</b>
                  </div>
                );
              })}
            </section>
            <Link href="/races/new" className="btn ghost">대회 기록 등록</Link>
          </>
        );
      })()}
    </Screen>
  );
}
