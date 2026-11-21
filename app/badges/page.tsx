"use client";

import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen } from "@/components/shell";
import { fullDateLabel } from "@/lib/format";
import { badgeImage, type Badge } from "@/lib/types";

/** 더보기 → 아이콘 선택: 얻은 아이콘 중 대표 고르기, 못 얻은 건 ?? (모양·이름·조건 비공개) */
export default function BadgesPage() {
  const { api, me, reload } = useCrew();
  const { data, error } = useLoad(() => api.myBadges(), []);
  const [pick, setPick] = useState<Badge | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setRep = async (id: string | null) => {
    setBusy(true); setErr(null);
    try { await api.setMyBadge(id); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const cur = pick ?? data?.earned.find((b) => b.id === me.badgeId) ?? null;

  return (
    <Screen title="아이콘 선택" back tab="/more">
      <ErrorText msg={error || err} />
      {!data ? <Loading /> : (
        <>
          <p className="sm" style={{ margin: 0 }}>
            모은 아이콘 <b style={{ color: "var(--accent)" }}>{data.earned.length}</b> / {data.total} · 고른 아이콘이 이름 앞에 보여요
          </p>
          <div className="bgrid" role="list">
            {data.earned.map((b) => (
              <button key={b.id} type="button" role="listitem"
                className={`bslot${me.badgeId === b.id ? " on" : ""}${cur?.id === b.id && me.badgeId !== b.id ? " sel" : ""}`}
                onClick={() => setPick(b)} aria-label={`${b.name}${me.badgeId === b.id ? ", 대표 아이콘" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="px" src={badgeImage(b.id)} alt="" width={88} height={88} />
                <span className="bn">{me.badgeId === b.id ? "대표" : b.name}</span>
              </button>
            ))}
            {Array.from({ length: Math.max(0, data.total - data.earned.length) }, (_, i) => (
              <div key={`l${i}`} className="bslot lock" role="listitem" aria-label="아직 얻지 못한 아이콘">??</div>
            ))}
          </div>

          {cur ? (
            <section className="card stack" style={{ gap: 6 }} aria-label="고른 아이콘">
              <div className="ap">
                <b style={{ fontSize: 16 }}>{cur.name}</b>
                {me.badgeId === cur.id && <span className="bg">대표 아이콘</span>}
              </div>
              <div className="sm">{cur.description}</div>
              {cur.earnedAt && <div className="sm">{fullDateLabel(cur.earnedAt.slice(0, 10))} 획득</div>}
              {me.badgeId === cur.id
                ? <button className="btn small ghost" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => setRep(null)}>아이콘 없이 이름만 보이기</button>
                : <button className="btn small" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => setRep(cur.id)}>대표 아이콘으로 설정</button>}
            </section>
          ) : (
            <div className="card empty">{data.earned.length ? "아이콘을 눌러 대표 아이콘으로 정해 보세요." : "아직 얻은 아이콘이 없어요. 크루 활동을 하다 보면 숨은 아이콘을 얻을 수 있어요!"}</div>
          )}
          <p className="sm" style={{ margin: 0, textAlign: "center" }}>?? 아이콘은 어떻게 얻는지 비밀이에요 🤫</p>
        </>
      )}
    </Screen>
  );
}
