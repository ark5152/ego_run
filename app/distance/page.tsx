"use client";

import { useEffect, useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Screen } from "@/components/shell";
import { Icon } from "@/components/icons";
import { km, monthLabel, monthStr, shiftMonth } from "@/lib/format";

/** 사진을 긴 변 1600px JPEG 로 줄여 저장 용량을 아낀다 */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const STATUS = { pending: ["검토 중", "bg gray"], approved: ["인정", "bg"], rejected: ["반려", "bg gray"] } as const;

export default function DistancePage() {
  const { api, me, reload: reloadCrew } = useCrew();
  const now = monthStr();
  // 1일에는 지난달 기록을 인증하는 날이므로 지난달을 먼저 골라 둠
  const [month, setMonth] = useState(new Date().getDate() === 1 ? shiftMonth(now, -1) : now);
  const [value, setValue] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mine = useLoad(() => api.listDistance({ memberId: me.id, fromMonth: shiftMonth(now, -2) }), [me.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const n = Number(value);
  const valid = value !== "" && Number.isFinite(n) && n > 0 && n < 10000 && !!photo;

  const submit = async () => {
    if (!valid || !photo) return;
    setBusy(true); setErr(null);
    try {
      await api.submitDistance({ month, km: Math.round(n * 10) / 10, photo: await shrink(photo) });
      setValue(""); setPhoto(null); setPreview(null); setDone(true);
      mine.reload(); reloadCrew();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const list = [...(mine.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen title="거리 제출" back tab="/">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="field">
          <label htmlFor="mo">인증 월</label>
          <div className="sort">
            <select id="mo" className="inp" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value={now}>{monthLabel(now)}</option>
              <option value={shiftMonth(now, -1)}>{monthLabel(shiftMonth(now, -1))}</option>
            </select>
            <Icon name="down" small />
          </div>
        </div>
        <div className="field">
          <label htmlFor="km">거리 (km)</label>
          <input id="km" className="inp" inputMode="decimal" placeholder="예: 42.2" value={value}
            onChange={(e) => { setValue(e.target.value.replace(/[^0-9.]/g, "")); setDone(false); }} />
        </div>
        <div className="field">
          <span className="lbl">인증 사진 (러닝 앱 월간 기록 캡처)</span>
          <label className="btn ghost" style={{ position: "relative" }}>
            <Icon name="camera" small /> {photo ? "사진 바꾸기" : "사진 선택"}
            <input type="file" accept="image/*" style={{ position: "absolute", inset: 0, opacity: 0 }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setPhoto(f); setDone(false);
                setPreview(f ? URL.createObjectURL(f) : null);
              }} />
          </label>
          {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="선택한 인증 사진" className="photo" />}
        </div>
        <ErrorText msg={err} />
        {done && <p className="sm" role="status" style={{ margin: 0, textAlign: "center" }}>제출했어요. 운영진이 인정하면 반영돼요.</p>}
        <button className="btn" disabled={!valid || busy}>{busy ? "제출 중…" : "제출"}</button>
      </form>

      <div className="section-title">최근 제출</div>
      <section className="card tight">
        {list.length === 0 && <div className="empty">최근 3개월 동안 제출한 기록이 없어요.</div>}
        {list.map((d) => (
          <div className="row" key={d.id}>
            <span>{monthLabel(d.month)} · <b>{km(d.km)}</b></span>
            <span className={STATUS[d.status][1]}>{STATUS[d.status][0]}</span>
          </div>
        ))}
      </section>
    </Screen>
  );
}
