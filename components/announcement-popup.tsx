"use client";

import { useEffect, useState } from "react";
import { todayStr } from "@/lib/format";
import { badgeImage, objParticle, type Announcement, type Api, type Badge } from "@/lib/types";
import { useCrew } from "./crew";

const SEEN_KEY = "ego-ann-seen";

function seenIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
}
/** 이 기기에서 확인한 공지로 기록(작성한 운영진 본인에게는 팝업을 띄우지 않기 위해서도 사용) */
export function markSeen(id: string) {
  try {
    const s = seenIds(); s.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200)));
  } catch { /* 저장소를 못 쓰면 이번 화면에서만 닫힘 */ }
}

type Item = { kind: "notice"; a: Announcement } | { kind: "badge"; b: Badge };

/** 앱을 열면: ① 아직 확인하지 않은 공지 ② 새로 얻은 아이콘 축하 — 차례로 띄움 */
export function AnnouncementPopup({ api }: { api: Api }) {
  const { reload } = useCrew();
  const [queue, setQueue] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const today = todayStr();
      const seen = seenIds();
      // 둘 중 하나가 실패해도 나머지는 보여 줌
      const [notices, badges] = await Promise.all([
        api.listAnnouncements().catch(() => [] as Announcement[]),
        api.claimBadges().catch(() => [] as Badge[]),
      ]);
      if (!alive) return;
      setQueue([
        ...notices.filter((a) => a.popupUntil >= today && !seen.has(a.id)).reverse().map((a): Item => ({ kind: "notice", a })),
        ...badges.map((b): Item => ({ kind: "badge", b })),
      ]);
    })();
    return () => { alive = false; };
  }, [api]);

  const cur = queue[0];
  if (!cur) return null;
  const next = () => setQueue((q) => q.slice(1));

  if (cur.kind === "badge") {
    const b = cur.b;
    const done = async (represent: boolean) => {
      setBusy(true);
      try {
        await api.markBadgesSeen([b.id]);
        if (represent) { await api.setMyBadge(b.id); await reload(); }
      } catch { /* 다음에 앱을 열면 다시 보여 줌 */ }
      finally { setBusy(false); next(); }
    };
    return (
      <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="badge-title">
        <div className="modal cele">
          <div className="bg">새 아이콘</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="px cele-img" src={badgeImage(b.id)} alt="" width={88} height={88} />
          <h2 id="badge-title" className="cele-t">🎉 축하합니다!<br />{b.name}{objParticle(b.name)}<br />획득하였습니다</h2>
          {b.description && <p className="cele-c">{b.description}</p>}
          <button className="btn" disabled={busy} onClick={() => done(true)}>대표 아이콘으로 설정</button>
          <button className="btn ghost" disabled={busy} onClick={() => done(false)}>닫기</button>
        </div>
      </div>
    );
  }

  const a = cur.a;
  const close = () => { markSeen(a.id); next(); };

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="ann-title">
      <div className="modal">
        <div className="bg" style={{ alignSelf: "flex-start" }}>공지</div>
        <h2 id="ann-title" className="h2" style={{ fontSize: 19 }}>{a.title}</h2>
        {a.body && <p className="ann-body">{a.body}</p>}
        <button className="btn" onClick={close} autoFocus>{queue.length > 1 ? "확인 · 다음" : "확인"}</button>
        <p className="sm" style={{ margin: 0, textAlign: "center" }}>확인한 공지는 다시 뜨지 않아요 · 더보기 → 공지사항에서 다시 볼 수 있어요</p>
      </div>
    </div>
  );
}
