"use client";

import Link from "next/link";
import { useState } from "react";
import { useCrew, useLoad } from "./crew";
import { Icon, type IconName } from "./icons";
import { ErrorText } from "./shell";
import { monthRange, monthStr, parseMonth, shiftMonth, shortDayLabel, sortKo, dateStr, todayStr } from "@/lib/format";
import { countsAsAttendance, isNewbie, type Member } from "@/lib/types";

type Panel = "att" | "dist" | null;

/** 운영진 전용: 이번 달 기준 미달자 한눈에 보기 + 카톡 독려문 복사 */
export function AdminDashboard() {
  const { api, settings } = useCrew();
  const [month, setMonth] = useState(monthStr());
  const [open, setOpen] = useState<Panel>(null);
  const [copied, setCopied] = useState(false);

  const { data, error } = useLoad(async () => {
    const { from, to } = monthRange(month);
    const [members, att, dist, pendingDist] = await Promise.all([
      api.listMembers(),
      api.listAttendance({ from, to }),
      api.listDistance({ fromMonth: month, toMonth: month }),
      api.listDistance({ status: "pending" }),
    ]);
    return { members, att, dist, pendingDist };
  }, [month]);

  const { y, m } = parseMonth(month);
  const deadline = dateStr(new Date(y, m, 1)); // 다음 달 1일
  const today = todayStr();
  const daysLeft = Math.round((new Date(deadline).getTime() - new Date(today).getTime()) / 86400000);
  const dLabel = daysLeft > 0 ? `마감 D-${daysLeft}` : daysLeft === 0 ? "오늘 마감" : "마감 지남";

  let body = null;
  let summary = { short: [] as { m: Member; n: number }[], uncert: [] as { m: Member; why: string }[], joins: 0, reviews: 0, below: 0, newbies: [] as Member[] };
  if (data) {
    const all = sortKo(data.members.filter((x) => x.status === "active"), (x) => x.name);
    // 신입(이 달에 가입 승인)은 참석·거리 판단에서 뺌
    const newbies = all.filter((x) => isNewbie(x, month, settings));
    const active = all.filter((x) => !isNewbie(x, month, settings));
    const runAtt = data.att.filter(countsAsAttendance); // 출석은 '러닝'만
    const countOf = (id: string) => runAtt.filter((a) => a.memberId === id).length;
    const short = active.map((x) => ({ m: x, n: countOf(x.id) })).filter((r) => r.n < settings.minAttendance);
    const uncert = active.flatMap((x) => {
      const mine = data.dist.filter((d) => d.memberId === x.id);
      const ok = mine.filter((d) => d.status === "approved").reduce((s, d) => s + d.km, 0);
      if (ok >= settings.distanceTarget) return [];
      const why = mine.some((d) => d.status === "pending") ? "검토 대기"
        : ok > 0 ? `${Math.round(ok * 10) / 10}km` : "미제출";
      return [{ m: x, why }];
    });
    const belowIds = new Set([...short.map((r) => r.m.id), ...uncert.map((r) => r.m.id)]);
    summary = {
      short, uncert,
      joins: data.members.filter((x) => x.status === "pending").length,
      reviews: data.pendingDist.length,
      below: belowIds.size,
      newbies,
    };
  }

  const names = (list: { m: Member }[], max = 3) =>
    list.length === 0 ? "없음" : list.slice(0, max).map((r) => r.m.name).join(", ") + (list.length > max ? ` 외 ${list.length - max}명` : "");

  const copyText = async () => {
    const lines = [
      `[EGO 러닝크루 ${m}월 기준 안내] 🏃`,
      "",
      `✔ 참석 부족 (월 ${settings.minAttendance}회 이상, 러닝 일정 기준)`,
      summary.short.length ? summary.short.map((r) => `- ${r.m.name} (${settings.minAttendance - r.n}회 남음)`).join("\n") : "- 없음 👏",
      "",
      `✔ 거리 인증 (${settings.distanceTarget}km, ${shortDayLabel(deadline)}까지)`,
      // 검토 대기는 이미 제출한 사람이라 독려 대상에서 뺌
      ...(() => { const todo = summary.uncert.filter((r) => r.why !== "검토 대기");
        return [todo.length ? todo.map((r) => `- ${r.m.name} (${r.why === "미제출" ? "미제출" : `${r.why} 인정, 추가 필요`})`).join("\n") : "- 없음 👏"]; })(),
      "",
      "남은 기간 함께 달려요! Everyday GO 💪",
    ];
    const text = lines.join("\n");
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  if (data) {
    body = (
      <>
        <div className="dash">
          <Cell icon="warn" tone="warn" label={`참석 부족`} value={summary.short.length} sub={names(summary.short)}
            open={open === "att"} onClick={() => setOpen(open === "att" ? null : "att")} />
          <Cell icon="camera" tone="info" label="거리 미인증" value={summary.uncert.length} sub={dLabel}
            open={open === "dist"} onClick={() => setOpen(open === "dist" ? null : "dist")} />
          <Cell icon="userAdd" tone="accent" label="가입 승인 대기" value={summary.joins} sub={summary.joins ? "눌러서 승인" : "없음"} href="/admin/approvals" />
          <Cell icon="inbox" tone="accent" label="거리 검토 대기" value={summary.reviews} sub={summary.reviews ? "눌러서 검토" : "없음"} href="/admin/approvals" />
        </div>

        {open === "att" && (
          <div className="dash-list" aria-label="참석 부족 명단">
            {summary.short.length === 0 && <div className="sm">모두 최소 참석을 채웠어요 👏</div>}
            {summary.short.map((r) => (
              <div className="dash-row" key={r.m.id}><span>{r.m.name}</span><b>{r.n}회 · {settings.minAttendance - r.n}회 남음</b></div>
            ))}
          </div>
        )}
        {open === "dist" && (
          <div className="dash-list" aria-label="거리 미인증 명단">
            {summary.uncert.length === 0 && <div className="sm">모두 거리 인증을 마쳤어요 👏</div>}
            {summary.uncert.map((r) => (
              <div className="dash-row" key={r.m.id}><span>{r.m.name}</span><b className={r.why === "미제출" ? "red" : ""}>{r.why}</b></div>
            ))}
          </div>
        )}

        <button type="button" className="dash-copy" onClick={copyText}>
          <Icon name="copy" small /> {copied ? "복사했어요! 카톡에 붙여넣으세요" : "미달 독려문 복사 (카톡용)"}
        </button>
        <div className="dash-foot">기준 미달 {summary.below}명{summary.newbies.length > 0 && ` · 신입 ${summary.newbies.length}명 제외`} · 월 참석 {settings.minAttendance}회 · 거리 {settings.distanceTarget}km</div>
      </>
    );
  }

  return (
    <section className="card dash-card" aria-label="운영 현황">
      <div className="dash-head">
        <h2 className="h2">운영 현황</h2>
        <div className="dash-mon">
          <button className="icon-btn" aria-label="이전 달" onClick={() => { setMonth(shiftMonth(month, -1)); setOpen(null); }}><Icon name="left" small /></button>
          <b>{y}년 {m}월</b>
          <button className="icon-btn" aria-label="다음 달" disabled={month >= monthStr()} onClick={() => { setMonth(shiftMonth(month, 1)); setOpen(null); }}><Icon name="right" small /></button>
        </div>
      </div>
      <ErrorText msg={error} />
      {body ?? <div className="spin" style={{ padding: "24px 0" }}>불러오는 중…</div>}
    </section>
  );
}

function Cell({ icon, tone, label, value, sub, onClick, href, open }: {
  icon: IconName; tone: "warn" | "info" | "accent"; label: string; value: number; sub: string;
  onClick?: () => void; href?: string; open?: boolean;
}) {
  const inner = (
    <>
      <span className={`dash-label ${tone}`}><Icon name={icon} small /> {label}</span>
      <span className="dash-val"><b>{value}</b> 명</span>
      <span className="dash-sub">{sub}</span>
    </>
  );
  return href
    ? <Link href={href} className="dash-cell">{inner}</Link>
    : <button type="button" className={`dash-cell${open ? " on" : ""}`} onClick={onClick} aria-expanded={open}>{inner}</button>;
}
