"use client";

import Link from "next/link";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen } from "@/components/shell";
import { hms, km, monthLabel, monthStr, parseMonth, shiftMonth } from "@/lib/format";

export default function HomePage() {
  const { api, me, settings } = useCrew();
  const month = monthStr();

  const { data, error } = useLoad(async () => {
    const [att, dist, races] = await Promise.all([
      api.listAttendance({ memberId: me.id }),
      api.listDistance({ memberId: me.id }),
      api.listRaceRecords({ memberId: me.id }),
    ]);
    return { att, dist, races };
  }, [me.id]);

  return (
    <Screen title="홈">
      <div className="section-title" style={{ marginTop: 0 }}>{monthLabel(month)}</div>
      <ErrorText msg={error} />
      {!data ? <Loading /> : (() => {
        const approved = data.dist.filter((d) => d.status === "approved");
        const attIn = (ym: string) => data.att.filter((a) => a.date.startsWith(ym)).length;
        const distIn = (ym: string) => approved.filter((d) => d.month === ym).reduce((s, d) => s + d.km, 0);
        const pendingKm = data.dist.filter((d) => d.status === "pending" && d.month === month).reduce((s, d) => s + d.km, 0);

        const attNow = attIn(month);
        const distNow = distIn(month);
        const pct = (v: number, goal: number) => (goal <= 0 ? 100 : Math.min(100, (v / goal) * 100));
        const months = [shiftMonth(month, -2), shiftMonth(month, -1), month];
        const best = (c: "full" | "half") => {
          const rs = data.races.filter((r) => r.course === c);
          return rs.length ? Math.min(...rs.map((r) => r.seconds)) : null;
        };

        return (
          <>
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
                {pendingKm > 0 ? `${km(pendingKm)} 검토 중 · ` : ""}관리자가 인정하면 반영돼요
              </div>
            </section>

            <div className="section-title">내 기록</div>
            <section className="card" aria-label="내 기록">
              <div className="two">
                <div><div className="sm">누적 출석</div><div className="big">{data.att.length}<small>회</small></div></div>
                <div><div className="sm">누적 거리</div><div className="big">{(Math.round(approved.reduce((s, d) => s + d.km, 0) * 10) / 10).toFixed(1)}<small>km</small></div></div>
              </div>
              <div className="tb th"><span>월별</span><span>출석</span><span>거리</span></div>
              {months.map((ym) => {
                const d = distIn(ym);
                return (
                  <div className="tb" key={ym}>
                    <span>{parseMonth(ym).m}월</span><span>{attIn(ym)}회</span><span>{d > 0 ? km(d) : "—"}</span>
                  </div>
                );
              })}
            </section>

            <div className="section-title">최고기록</div>
            <section className="card tight" aria-label="최고기록">
              {(["full", "half"] as const).map((c) => {
                const b = best(c);
                return (
                  <div className="row" key={c}>
                    <span>{c === "full" ? "풀코스" : "하프코스"}</span>
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
