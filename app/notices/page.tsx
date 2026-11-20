"use client";

import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen } from "@/components/shell";
import { markSeen } from "@/components/announcement-popup";
import { dateStr, fullDateLabel, todayStr } from "@/lib/format";

const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dateStr(d); };

export default function NoticesPage() {
  const { api, isAdmin } = useCrew();
  const { data, error, reload } = useLoad(() => api.listAnnouncements(), []);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [until, setUntil] = useState(plusDays(7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    setErr(null); setMsg(null);
    if (!title.trim()) return setErr("제목을 입력해 주세요.");
    if (until < todayStr()) return setErr("팝업 기간은 오늘 이후로 정해 주세요.");
    setBusy(true);
    try {
      markSeen(await api.createAnnouncement({ title: title.trim(), body: body.trim(), popupUntil: until }));
      setTitle(""); setBody(""); setUntil(plusDays(7)); setMsg("공지를 올렸어요. 회원들이 앱을 열면 팝업으로 보여요.");
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("이 공지를 삭제할까요?")) return;
    try { await api.deleteAnnouncement(id); reload(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const today = todayStr();

  return (
    <Screen title="공지사항" back tab="/more">
      {isAdmin && (
        <section className="card stack" aria-label="공지 작성">
          <h2 className="h2">공지 작성</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
            <input className="inp" aria-label="제목" placeholder="제목" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="inp area" aria-label="내용" placeholder="내용 (선택)" maxLength={2000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="field">
              <label htmlFor="until">팝업으로 띄울 마지막 날</label>
              <input id="until" className="inp" type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} />
              <span className="sm">이 날까지 앱을 여는 회원에게 한 번씩 팝업으로 보여요. 기간이 지나도 공지사항 목록에는 남아요.</span>
            </div>
            <ErrorText msg={err} />
            {msg && <p className="sm" role="status" style={{ margin: 0, textAlign: "center" }}>{msg}</p>}
            <button className="btn" disabled={busy}>{busy ? "올리는 중…" : "공지 올리기"}</button>
          </form>
        </section>
      )}

      <ErrorText msg={error} />
      {!data ? <Loading /> : (
        <div className="stack">
          {data.length === 0 && <div className="card empty">아직 공지가 없어요.</div>}
          {data.map((a) => (
            <article className="card stack" key={a.id} style={{ gap: 6 }}>
              <div className="ap">
                <span className="sm">{fullDateLabel(a.createdAt.slice(0, 10))}</span>
                {a.popupUntil >= today && <span className="bg">팝업 ~{Number(a.popupUntil.slice(5, 7))}/{Number(a.popupUntil.slice(8))}</span>}
              </div>
              <div className="h2">{a.title}</div>
              {a.body && <p className="ann-body" style={{ margin: 0 }}>{a.body}</p>}
              {isAdmin && <button className="btn small danger" style={{ alignSelf: "flex-end" }} onClick={() => remove(a.id)}>삭제</button>}
            </article>
          ))}
        </div>
      )}
    </Screen>
  );
}
