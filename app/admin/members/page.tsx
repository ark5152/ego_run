"use client";

import { useState } from "react";
import { useCrew, useLoad } from "@/components/crew";
import { ErrorText, Loading, Screen, Tabs } from "@/components/shell";
import { sortKo } from "@/lib/format";
import { isStaff, type Gender, type Member } from "@/lib/types";

const STATUS_LABEL = { active: "활동", pending: "승인 대기", unclaimed: "미가입" } as const;

export default function MembersAdminPage() {
  const { api, me, isAdmin, reload: reloadCrew } = useCrew();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("M");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ id: string; name: string; code: string } | null>(null);

  const { data, error, reload } = useLoad(() => api.listMembers(), []);

  if (!isAdmin) return <Screen title="회원 관리" back tab="/more"><div className="empty">운영진만 볼 수 있어요</div></Screen>;

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    try { await fn(); reload(); reloadCrew(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const add = () => run(async () => {
    const n = name.trim();
    if (!n) return;
    await api.addMember({ name: n, gender });
    setName("");
  });

  const list = sortKo((data ?? []).filter((m) => m.name.includes(q.trim())), (m) => m.name);

  return (
    <Screen title="회원 관리" back tab="/more">
      <section className="card stack">
        <h2 className="h2">명단에 추가</h2>
        <p className="sm" style={{ margin: 0 }}>본인이 앱의 ‘처음 가입’에서 이 이름과 숫자 4자리 비밀번호로 가입하면, 승인 관리에서 승인해 주세요.</p>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="inp" aria-label="이름" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
          <Tabs value={gender} onChange={setGender} options={[{ value: "M", label: "남자" }, { value: "F", label: "여자" }]} />
          <button className="btn" disabled={!name.trim()}>추가</button>
        </form>
      </section>

      <ErrorText msg={error || err} />
      <input className="inp" aria-label="이름 검색" placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      {!data ? <Loading /> : (
        <section className="card tight" aria-label="회원 목록">
          {list.map((m) => (
            <MemberRow key={m.id} m={m} isMe={m.id === me.id} open={open === m.id}
              onToggle={() => setOpen(open === m.id ? null : m.id)}
              onPatch={(p) => run(() => api.updateMember(m.id, p))}
              resetCode={resetInfo?.id === m.id ? resetInfo.code : null}
              onReset={() => {
                if (!confirm(`${m.name} 님의 비밀번호를 초기화할까요? 지금 비밀번호로는 더 이상 로그인할 수 없고, 잠금도 풀려요.`)) return;
                run(async () => { const code = await api.adminResetSecret(m.id); setResetInfo({ id: m.id, name: m.name, code }); });
              }}
              onDelete={() => { if (confirm(`${m.name} 님을 명단에서 삭제할까요? 출석·거리·대회 기록도 함께 지워져요.`)) run(() => api.deleteMember(m.id)); }} />
          ))}
        </section>
      )}
    </Screen>
  );
}

function MemberRow({ m, isMe, open, onToggle, onPatch, onDelete, onReset, resetCode }: {
  m: Member; isMe: boolean; open: boolean; onToggle: () => void; onReset: () => void; resetCode: string | null;
  onPatch: (p: Partial<Pick<Member, "gender" | "role" | "isLeader">>) => void; onDelete: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <button type="button" className="row" onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", border: 0, background: "none", padding: 0, textAlign: "left" }}>
        <span>
          {m.name}
          {isStaff(m) && <span className="tg me">운영진</span>}
        </span>
        <span className={m.status === "active" ? "sm" : "bg"}>{STATUS_LABEL[m.status]} · {m.gender === "M" ? "남" : "여"}</span>
      </button>
      {open && (
        <div className="stack" style={{ padding: "4px 0 14px" }}>
          <Tabs value={m.gender} onChange={(g) => onPatch({ gender: g })} options={[{ value: "M", label: "남자" }, { value: "F", label: "여자" }]} />
          <button className="btn small ghost" disabled={isMe} onClick={() => onPatch(isStaff(m) ? { role: "member", isLeader: false } : { role: "admin", isLeader: true })}>
            {isStaff(m) ? "운영진 해제" : "운영진 지정"}
          </button>
          {!isStaff(m) && m.userId && <span className="sm" style={{ textAlign: "center" }}>운영진으로 지정하면 다음 로그인 때 영문+숫자 8자리 이상 비밀번호로 바꿔야 운영진 기능이 열려요</span>}
          {isMe && <span className="sm" style={{ textAlign: "center" }}>본인의 운영진 권한은 다른 운영진이 바꿀 수 있어요</span>}
          {m.userId && !isMe && <button className="btn small ghost" onClick={onReset}>비밀번호 초기화 · 잠금 해제</button>}
          {resetCode && (
            <div className="confirm" role="status">
              <span>재설정 코드 <b style={{ fontSize: 20, letterSpacing: 3 }}>{resetCode}</b> (24시간 유효)</span>
              <span className="sm">{m.name} 님에게 직접 전달해 주세요. 앱의 ‘재설정’에서 이 코드로 새 비밀번호를 정해요. 이 화면을 벗어나면 다시 볼 수 없어요.</span>
            </div>
          )}
          {!isMe && <button className="btn small danger" onClick={onDelete}>명단에서 삭제</button>}
        </div>
      )}
    </div>
  );
}
