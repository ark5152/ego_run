"use client";

import { useEffect, useState } from "react";
import { todayStr } from "@/lib/format";
import type { Announcement, Api } from "@/lib/types";

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

/** 앱을 열면 게시 기간 중인, 이 기기에서 아직 확인하지 않은 공지를 차례로 띄움 */
export function AnnouncementPopup({ api }: { api: Api }) {
  const [queue, setQueue] = useState<Announcement[]>([]);

  useEffect(() => {
    let alive = true;
    api.listAnnouncements().then((all) => {
      if (!alive) return;
      const today = todayStr();
      const seen = seenIds();
      setQueue(all.filter((a) => a.popupUntil >= today && !seen.has(a.id)).reverse()); // 오래된 것부터
    }).catch(() => { /* 공지를 못 불러와도 앱 사용에는 지장 없음 */ });
    return () => { alive = false; };
  }, [api]);

  const cur = queue[0];
  if (!cur) return null;
  const close = () => { markSeen(cur.id); setQueue((q) => q.slice(1)); };

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="ann-title">
      <div className="modal">
        <div className="bg" style={{ alignSelf: "flex-start" }}>공지{queue.length > 1 ? ` · ${queue.length}개` : ""}</div>
        <h2 id="ann-title" className="h2" style={{ fontSize: 19 }}>{cur.title}</h2>
        {cur.body && <p className="ann-body">{cur.body}</p>}
        <button className="btn" onClick={close} autoFocus>{queue.length > 1 ? "확인 · 다음 공지" : "확인"}</button>
        <p className="sm" style={{ margin: 0, textAlign: "center" }}>확인한 공지는 다시 뜨지 않아요 · 더보기 → 공지사항에서 다시 볼 수 있어요</p>
      </div>
    </div>
  );
}
