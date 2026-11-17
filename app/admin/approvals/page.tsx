"use client";

import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen, Tabs } from "@/components/shell";
import { km, monthLabel } from "@/lib/format";

export default function ApprovalsPage() {
  const { api, isAdmin, reload: reloadCrew } = useCrew();
  const [tab, setTab] = useState<"join" | "dist">("dist");
  const [photo, setPhoto] = useState<{ id: string; url: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, error, reload } = useLoad(async () => {
    const [members, dist] = await Promise.all([api.listMembers(), api.listDistance({ status: "pending" })]);
    return { members, joins: members.filter((m) => m.status === "pending"), dist };
  }, []);

  if (!isAdmin) return <Screen title="승인 대기" back tab="/more"><div className="empty">관리자만 볼 수 있어요</div></Screen>;

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id); setErr(null);
    try { await fn(); reload(); reloadCrew(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(null); }
  };

  const showPhoto = async (id: string, path: string | null) => {
    if (photo?.id === id) return setPhoto(null);
    setPhoto({ id, url: path ? await api.getPhotoUrl(path) : null });
  };

  const name = (id: string) => data?.members.find((m) => m.id === id)?.name ?? "알 수 없음";

  return (
    <Screen title="승인 대기" back tab="/more">
      <Tabs value={tab} onChange={setTab} options={[
        { value: "join", label: `가입 요청${data?.joins.length ? ` ${data.joins.length}` : ""}` },
        { value: "dist", label: `거리 제출${data?.dist.length ? ` ${data.dist.length}` : ""}` },
      ]} />
      <ErrorText msg={error || err} />
      {!data ? <Loading /> : tab === "join" ? (
        <div className="stack">
          {data.joins.length === 0 && <div className="card empty">대기 중인 가입 요청이 없어요.</div>}
          {data.joins.map((m) => (
            <div className="card ap" key={m.id}>
              <div><b>{m.name}</b><div className="sm">명단의 이 이름으로 가입을 요청했어요</div></div>
              <div className="acts">
                <button className="btn small ghost" disabled={busyId === m.id} onClick={() => act(m.id, () => api.reviewJoin(m.id, false))}>반려</button>
                <button className="btn small" disabled={busyId === m.id} onClick={() => act(m.id, () => api.reviewJoin(m.id, true))}>승인</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="sm" style={{ margin: 0 }}>인정하면 거리가 반영돼요 · 사진을 눌러 확인하세요</p>
          <div className="stack">
            {data.dist.length === 0 && <div className="card empty">대기 중인 거리 제출이 없어요.</div>}
            {data.dist.map((d) => (
              <div className="card stack" key={d.id} style={{ gap: 10 }}>
                <div className="ap">
                  <button type="button" className="ap" style={{ border: 0, background: "none", padding: 0, textAlign: "left", gap: 12 }}
                    onClick={() => showPhoto(d.id, d.photoPath)} aria-expanded={photo?.id === d.id}>
                    <div>
                      <b>{name(d.memberId)}</b>
                      <div className="sm">{monthLabel(d.month)} · {km(d.km)} · {d.photoPath ? "사진 1장" : "사진 없음"}</div>
                    </div>
                  </button>
                  <div className="acts">
                    <button className="btn small ghost" disabled={busyId === d.id} onClick={() => act(d.id, () => api.reviewDistance(d.id, false))}>반려</button>
                    <button className="btn small" disabled={busyId === d.id} onClick={() => act(d.id, () => api.reviewDistance(d.id, true))}>인정</button>
                  </div>
                </div>
                {photo?.id === d.id && (photo.url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={photo.url} alt={`${name(d.memberId)} 인증 사진`} className="photo" />
                  : <div className="sm">사진을 불러올 수 없어요.</div>)}
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
