"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen, Tabs } from "@/components/shell";
import { Crown, Icon } from "@/components/icons";
import { COURSE_LABEL, hms } from "@/lib/format";
import type { Course, Gender } from "@/lib/types";

const COURSES: Course[] = ["full", "half", "10k"];

export default function RacesPage() {
  const { api } = useCrew();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [gender, setGender] = useState<Gender>("M");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data, error } = useLoad(async () => {
    const [members, records] = await Promise.all([api.listMembers(), api.listRaceRecords({ year })]);
    return { members, records };
  }, [year]);

  const years = Array.from({ length: 5 }, (_, i) => thisYear - i);

  return (
    <Screen title="대회" right={<Link href="/races/new" className="icon-btn" aria-label="대회 기록 등록"><Icon name="plus" /></Link>}>
      <div className="flt">
        <label className="sort">
          <span className="sr-only">연도</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <Icon name="down" small />
        </label>
        <Tabs small value={gender} onChange={setGender} options={[{ value: "M", label: "남자" }, { value: "F", label: "여자" }]} />
      </div>
      <ErrorText msg={error} />
      {!data ? <Loading /> : COURSES.map((c) => {
        const byId = new Map(data.members.map((m) => [m.id, m]));
        // 회원별 최고기록 1개만
        const best = new Map<string, number>();
        for (const r of data.records) {
          if (r.course !== c || byId.get(r.memberId)?.gender !== gender) continue;
          const cur = best.get(r.memberId);
          if (cur === undefined || r.seconds < cur) best.set(r.memberId, r.seconds);
        }
        const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
        const key = `${c}`;
        const shown = open[key] ? ranked : ranked.slice(0, 3);
        return (
          <section className="card" key={c} style={{ paddingBottom: 8 }} aria-label={COURSE_LABEL[c]}>
            <h2 className="h2" style={{ marginBottom: 4 }}>{COURSE_LABEL[c]}</h2>
            {ranked.length === 0 && <div className="empty" style={{ padding: "16px 0" }}>기록이 없어요</div>}
            {shown.map(([mid, sec], i) => (
              <div className="rk" key={mid}>
                <span className="no">{i === 0 ? <Crown /> : i + 1}</span>
                <span>{byId.get(mid)?.name}</span>
                <b>{hms(sec)}</b>
              </div>
            ))}
            {ranked.length > 3 && (
              <button className="more-btn" onClick={() => setOpen({ ...open, [key]: !open[key] })}>
                {open[key] ? "접기" : `전체 ${ranked.length}명 보기`}
              </button>
            )}
          </section>
        );
      })}
    </Screen>
  );
}
