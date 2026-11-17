"use client";

import { useState } from "react";
import { useCrew } from "@/components/crew";
import { ChangeSecretForm } from "@/components/join";
import { Screen } from "@/components/shell";

export default function PasswordPage() {
  const { api, me } = useCrew();
  const [done, setDone] = useState(false);
  const staff = me.role === "admin";
  return (
    <Screen title="비밀번호 변경" back tab="/more">
      <p className="sm" style={{ margin: 0 }}>
        {staff ? "운영진은 영문과 숫자를 섞은 8자리 이상으로 정해 주세요." : "숫자 4자리로 정해 주세요. 1111, 1234처럼 쉬운 번호는 쓸 수 없어요."}
      </p>
      {done
        ? <div className="card empty">비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요.</div>
        : <ChangeSecretForm api={api} staff={staff} onDone={() => setDone(true)} />}
    </Screen>
  );
}
