"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getApi } from "@/lib/api";
import type { Api, Member, Session, Settings } from "@/lib/types";
import { LoginScreen } from "./login";
import "./device"; // 홈 화면 추가 이벤트를 앱 시작 시점부터 받기 위해
import { JoinScreen, PendingScreen } from "./join";

interface Crew {
  api: Api;
  session: Session;
  me: Member;
  isAdmin: boolean;
  settings: Settings;
  pendingCount: number; // 관리자용: 승인 대기 건수
  reload: () => Promise<void>;
}

const Ctx = createContext<Crew | null>(null);

export function useCrew(): Crew {
  const c = useContext(Ctx);
  if (!c) throw new Error("CrewProvider 밖에서 사용됨");
  return c;
}

type State =
  | { k: "loading" }
  | { k: "error"; msg: string }
  | { k: "signedOut" }
  | { k: "noMember"; session: Session }
  | { k: "pending"; session: Session; me: Member }
  | { k: "ready"; session: Session; me: Member; settings: Settings; pendingCount: number };

export function CrewProvider({ children }: { children: ReactNode }) {
  const api = getApi();
  const [st, setSt] = useState<State>({ k: "loading" });

  const reload = useCallback(async () => {
    try {
      const session = await api.getSession();
      if (!session) return setSt({ k: "signedOut" });
      const me = await api.getMe();
      if (!me || me.status === "unclaimed") return setSt({ k: "noMember", session });
      if (me.status === "pending") return setSt({ k: "pending", session, me });
      const settings = await api.getSettings();
      let pendingCount = 0;
      if (me.role === "admin") {
        const [members, dist] = await Promise.all([api.listMembers(), api.listDistance({ status: "pending" })]);
        pendingCount = members.filter((m) => m.status === "pending").length + dist.length;
      }
      setSt({ k: "ready", session, me, settings, pendingCount });
    } catch (e) {
      setSt({ k: "error", msg: e instanceof Error ? e.message : String(e) });
    }
  }, [api]);

  useEffect(() => { reload(); }, [reload]);

  const demo = api.mode === "demo" ? <span className="demo">데모 모드</span> : null;

  if (st.k === "loading") return <div className="shell"><div className="spin">불러오는 중…</div></div>;
  if (st.k === "error") {
    return (
      <div className="shell"><div className="center">
        <p className="err">데이터를 불러오지 못했어요: {st.msg}</p>
        <button className="btn ghost" onClick={() => { setSt({ k: "loading" }); reload(); }}>다시 시도</button>
      </div></div>
    );
  }
  if (st.k === "signedOut") return <>{demo}<LoginScreen api={api} onDone={reload} /></>;
  if (st.k === "noMember") return <>{demo}<JoinScreen api={api} onDone={reload} /></>;
  if (st.k === "pending") return <>{demo}<PendingScreen api={api} me={st.me} onDone={reload} /></>;

  return (
    <Ctx.Provider value={{
      api, session: st.session, me: st.me, isAdmin: st.me.role === "admin",
      settings: st.settings, pendingCount: st.pendingCount, reload,
    }}>
      {demo}
      {children}
    </Ctx.Provider>
  );
}

/** 간단한 비동기 로더 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
