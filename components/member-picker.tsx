"use client";

import { useMemo, useState } from "react";
import { sortKo } from "@/lib/format";
import type { Member } from "@/lib/types";

/** 이름 칩을 눌러 참석자를 고르는 창(가나다순, 이름 검색) */
export function MemberPicker({ members, selected, onChange }: {
  members: Member[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [q, setQ] = useState("");
  const sorted = useMemo(() => sortKo(members, (m) => m.name), [members]);
  const query = q.trim();
  const list = query ? sorted.filter((m) => m.name.includes(query)) : sorted;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  return (
    <section className="card stack picker" aria-label="참석자 선택">
      <div className="ap">
        <b>참석자 <em className="pk-n">{selected.size}</em>명</b>
        {selected.size > 0 && (
          <button type="button" className="link-btn" onClick={() => onChange(new Set())}>전체 해제</button>
        )}
      </div>
      <input className="inp" type="search" placeholder="이름 검색" aria-label="이름 검색" value={q}
        onChange={(e) => setQ(e.target.value)} />
      <div className="chips" role="group" aria-label="회원 이름">
        {list.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={selected.has(m.id)} onClick={() => toggle(m.id)}>
            {m.name}
          </button>
        ))}
        {list.length === 0 && <div className="empty" style={{ gridColumn: "1 / -1", padding: "16px 0" }}>‘{query}’ 이름이 없어요.</div>}
      </div>
    </section>
  );
}
