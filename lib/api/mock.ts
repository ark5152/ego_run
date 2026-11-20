import type {
  Announcement, Api, AttendanceRow, CrewEvent, DistanceSubmission, Member, RaceRecord, Settings,
} from "../types";
import { dateStr } from "../format";
import { SOCIAL_PER_MONTH, secretError, type SecretKind } from "../types";

/**
 * 데모 모드: Supabase 설정이 없을 때 쓰는 예시 데이터.
 * 브라우저 localStorage 에 저장되며, '김서준(운영진)'으로 로그인된 상태로 시작한다.
 * 데모 로그인: 김서준 / egorun2026, 다른 활동 회원 / 2580
 * (데모는 모든 것이 브라우저 안에 있어 비밀번호를 숨기지 않음 — 실제 버전은 서버에서 확인)
 */

interface DemoSecret {
  secret: string | null;
  kind: SecretKind;
  failed: number;
  lockCount: number;
  lockedUntil: number | null; // ms, Infinity = 운영진 초기화 필요
  resetCode: string | null;
}

interface Db {
  members: Member[];
  settings: Settings;
  events: CrewEvent[];
  attendance: { eventId: string; memberId: string }[];
  distance: DistanceSubmission[];
  races: RaceRecord[];
  signedIn?: boolean; // 예전 데모 데이터 호환
  currentUid?: string | null;
  secrets?: Record<string, DemoSecret>;
  announcements?: Announcement[];
  myBadges?: { id: string; earnedAt: string; seen: boolean }[];
}

/*
 * 데모 아이콘: 실제 조건은 서버에만 있어 데모에는 넣지 않음(이 코드는 누구나 내려받을 수 있음).
 * 데모에서는 예시 아이콘 몇 개만 이미 얻은 것으로 보여 줌.
 */
const DEMO_TOTAL = 25;
const DEMO_BADGES: Record<string, { name: string; description: string }> = {
  "b892153ff": { name: "한복", description: "새해 첫날에 러닝을 했어요." },
  "b991270bd": { name: "맥주", description: "이구역 친목왕" },
  "b34155d47": { name: "크리스마스 트리", description: "크리스마스에 러닝을 했어요." },
  "bafdfbdd5": { name: "FULL 메달", description: "FULL 완주 축하합니다!" },
};
const DEMO_IDS = Object.keys(DEMO_BADGES);

const KEY = "ego-demo-v1";
const DEMO_UID = "demo-user";
let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function seed(): Db {
  const M = (id: string, name: string, gender: "M" | "F", extra: Partial<Member> = {}): Member => ({
    id, name, gender, role: "member", isLeader: false, status: "active", userId: null, badgeId: null, ...extra,
  });
  const members: Member[] = [
    M("m-seojun", "김서준", "M", { role: "admin", isLeader: true, userId: DEMO_UID }),
    M("m-jiho", "박지호", "M", { badgeId: DEMO_IDS[3] }),
    M("m-minjae-c", "최민재", "M", { badgeId: DEMO_IDS[1] }),
    M("m-hayun", "이하윤", "F", { badgeId: DEMO_IDS[2] }),
    M("m-minjae-j", "정민재", "M"),
    M("m-yuna", "정유나", "F", { badgeId: DEMO_IDS[0] }),
    M("m-yujin", "최유진", "F"),
    M("m-daon", "강다온", "M"),
    M("m-taeyang", "오태양", "M"),
    M("m-soyul", "한소율", "F"),
    M("m-seoa", "윤서아", "F", { status: "pending", userId: "someone-else" }),
    M("m-dohyun", "임도현", "M", { status: "unclaimed" }),
    M("m-harin", "송하린", "F", { status: "unclaimed" }),
  ];

  // 2026년 1월~12월, 매주 월·목 정기런 + 11/28 대회
  const events: CrewEvent[] = [];
  for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
    const w = d.getDay();
    if (w === 1) events.push({ id: `e-${dateStr(d)}`, date: dateStr(d), title: "월요 정기런(러닝)", kind: "run" });
    if (w === 4) events.push({ id: `e-${dateStr(d)}`, date: dateStr(d), title: "목요 인터벌벙(러닝)", kind: "run" });
  }
  events.push({ id: "e-race-1128", date: "2026-11-28", title: "가을 마라톤 단체 참가", kind: "event" });
  events.push({ id: "e-social-1121", date: "2026-11-21", title: "11월 크루 회식", kind: "social" });

  const today = dateStr(new Date());
  const past = events.filter((e) => e.date <= today && e.kind === "run");
  const byMonth = (ym: string) => past.filter((e) => e.date.startsWith(ym));

  const attendance: { eventId: string; memberId: string }[] = [];
  // 회원마다 시작 위치를 달리해 출석이 월초에 몰리지 않게 한다
  let rot = 0;
  const attend = (memberId: string, ym: string, count: number) => {
    const list = byMonth(ym);
    const start = rot++ % Math.max(1, list.length);
    for (let i = 0; i < Math.min(count, list.length); i++) {
      attendance.push({ eventId: list[(start + i) % list.length].id, memberId });
    }
  };

  // 김서준: 누적 21회 (7월 3, 8월 5, 9월 4, 10월 5, 11월 4)
  [["2026-07", 3], ["2026-08", 5], ["2026-09", 4], ["2026-10", 5], ["2026-11", 4]].forEach(([ym, n]) =>
    attend("m-seojun", ym as string, n as number));
  // 다른 회원들: 1~10월은 고정 패턴, 11월은 참조 화면과 비슷하게
  const pattern: Record<string, number[]> = {
    "m-jiho": [6, 5, 7, 6, 6, 5, 7, 6, 6, 7, 4],
    "m-minjae-c": [4, 5, 4, 5, 4, 4, 5, 3, 4, 4, 3],
    "m-hayun": [5, 4, 5, 4, 6, 5, 4, 5, 5, 4, 3],
    "m-minjae-j": [2, 3, 2, 3, 2, 3, 2, 2, 3, 2, 2],
    "m-yuna": [2, 2, 3, 2, 2, 2, 3, 2, 2, 2, 2],
    "m-yujin": [1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1],
    "m-daon": [1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1],
    "m-taeyang": [3, 3, 2, 3, 3, 2, 3, 3, 2, 2, 0],
    "m-soyul": [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 0],
  };
  for (const [mid, counts] of Object.entries(pattern)) {
    counts.forEach((n, i) => attend(mid, `2026-${String(i + 1).padStart(2, "0")}`, n));
  }

  const distance: DistanceSubmission[] = [];
  const approved = (memberId: string, month: string, km: number) =>
    distance.push({ id: nid("d"), memberId, month, km, photoPath: null, status: "approved", createdAt: `${month}-28T12:00:00Z` });

  // 김서준: 누적 342.5km
  [30.1, 35.4, 28.0, 40.2, 33.5, 31.6, 32.0, 32.5, 38.2, 41.0].forEach((k, i) =>
    approved("m-seojun", `2026-${String(i + 1).padStart(2, "0")}`, k));
  const monthly: Record<string, number> = {
    "m-jiho": 51.3, "m-hayun": 42.1, "m-minjae-c": 39.8, "m-minjae-j": 21.0,
    "m-yuna": 17.6, "m-yujin": 13.5, "m-taeyang": 18.0, "m-daon": 8.2,
  };
  for (const [mid, base] of Object.entries(monthly)) {
    for (let i = 1; i <= 10; i++) approved(mid, `2026-${String(i).padStart(2, "0")}`, Math.round((base + ((i * 7) % 5) - 2) * 10) / 10);
  }
  approved("m-minjae-c", "2026-11", 33.2);
  approved("m-yuna", "2026-11", 31.0);
  approved("m-yujin", "2026-11", 30.4);
  const pend = (memberId: string, km: number) =>
    distance.push({ id: nid("d"), memberId, month: "2026-11", km, photoPath: null, status: "pending", createdAt: new Date().toISOString() });
  pend("m-jiho", 42.0);
  pend("m-hayun", 30.5);
  pend("m-minjae-j", 21.1);

  const R = (memberId: string, course: RaceRecord["course"], t: string, raceName: string, raceDate: string): RaceRecord => {
    const [h, m, s] = t.split(":").map(Number);
    return { id: nid("r"), memberId, course, seconds: h * 3600 + m * 60 + s, raceName, raceDate };
  };
  const races: RaceRecord[] = [
    R("m-jiho", "full", "03:07:45", "서울마라톤", "2026-03-15"),
    R("m-minjae-c", "full", "03:12:30", "서울마라톤", "2026-03-15"),
    R("m-seojun", "full", "03:44:04", "춘천마라톤", "2026-10-25"),
    R("m-jiho", "half", "01:24:08", "경기마라톤", "2026-04-12"),
    R("m-minjae-c", "half", "01:31:50", "경기마라톤", "2026-04-12"),
    R("m-taeyang", "half", "01:39:12", "경기마라톤", "2026-04-12"),
    R("m-seojun", "half", "01:45:46", "경기마라톤", "2026-04-12"),
    R("m-jiho", "10k", "00:38:41", "한강 10K", "2026-06-07"),
    R("m-taeyang", "10k", "00:40:12", "한강 10K", "2026-06-07"),
    R("m-minjae-c", "10k", "00:41:10", "한강 10K", "2026-06-07"),
    R("m-hayun", "full", "03:58:20", "춘천마라톤", "2026-10-25"),
    R("m-hayun", "half", "01:52:10", "경기마라톤", "2026-04-12"),
    R("m-yuna", "half", "01:49:30", "경기마라톤", "2026-04-12"),
    R("m-yuna", "10k", "00:47:12", "한강 10K", "2026-06-07"),
    R("m-yujin", "10k", "00:50:05", "한강 10K", "2026-06-07"),
    R("m-soyul", "10k", "00:52:40", "한강 10K", "2026-06-07"),
  ];

  return { members, settings: { minAttendance: 1, distanceTarget: 30, instagram: "" }, events, attendance, distance, races, currentUid: DEMO_UID };
}

async function toDataUrl(file: File, max: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

export function createMockApi(): Api {
  let db: Db | null = null;

  const load = (): Db => {
    if (db) return db;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) db = JSON.parse(raw) as Db;
    } catch { /* 저장소를 못 쓰면 메모리로만 */ }
    if (!db) db = seed();
    // 예전 데모 데이터 → 비밀번호 로그인 방식으로 옮기기
    if (db.members.some((m) => m.badgeId === undefined)) {
      const sample: Record<string, string> = { "m-jiho": DEMO_IDS[3], "m-hayun": DEMO_IDS[2], "m-minjae-c": DEMO_IDS[1], "m-yuna": DEMO_IDS[0] };
      for (const m of db.members) if (m.badgeId === undefined) m.badgeId = sample[m.id] ?? null;
    }
    if (!db.secrets) {
      db.secrets = {};
      for (const m of db.members) {
        if (m.status === "unclaimed") continue;
        if (!m.userId || m.userId === "someone-else") m.userId = m.userId === DEMO_UID ? DEMO_UID : `u-${m.id}`;
        const admin = m.role === "admin";
        db.secrets[m.id] = { secret: admin ? "egorun2026" : "2580", kind: admin ? "password" : "pin", failed: 0, lockCount: 0, lockedUntil: null, resetCode: null };
      }
      if (db.currentUid === undefined) db.currentUid = db.signedIn === false ? null : DEMO_UID;
      delete db.signedIn;
    }
    return db;
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
  };
  const me = () => { const d = load(); return d.currentUid ? d.members.find((m) => m.userId === d.currentUid) ?? null : null; };
  const kindFor = (m: Member): SecretKind => (m.role === "admin" ? "password" : "pin");
  const byName = (name: string) => load().members.find((m) => m.name === name.trim() && m.userId);
  const lockedMsg = (s: DemoSecret) => s.lockedUntil === Infinity
    ? "여러 번 틀려서 잠겼어요. 운영진에게 비밀번호 초기화를 요청해 주세요."
    : s.lockedUntil && s.lockedUntil > Date.now() ? `잠겨 있어요. ${Math.max(1, Math.ceil((s.lockedUntil - Date.now()) / 60000))}분 뒤에 다시 시도해 주세요.` : null;
  const failOnce = (s: DemoSecret) => {
    s.failed += 1;
    if (s.failed >= 5) {
      s.failed = 0; s.lockCount += 1;
      s.lockedUntil = s.lockCount >= 3 ? Infinity : Date.now() + 10 * 60000;
      save();
      return s.lockedUntil === Infinity ? lockedMsg(s)! : "5번 틀려서 10분 동안 잠겼어요.";
    }
    save();
    return `이름 또는 비밀번호가 맞지 않아요. (${5 - s.failed}번 더 틀리면 잠겨요)`;
  };
  const eventDate = (id: string) => load().events.find((e) => e.id === id)?.date ?? "";
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

  return {
    mode: "demo",

    async getSession() {
      const d = load();
      return d.currentUid ? { userId: d.currentUid } : null;
    },
    async login(name, secret) {
      const m = byName(name);
      const s = m && load().secrets![m.id];
      if (!m || !s) throw new Error("이름 또는 비밀번호가 맞지 않아요.");
      const locked = lockedMsg(s);
      if (locked) throw new Error(locked);
      if (s.secret === null) throw new Error("비밀번호가 초기화됐어요. ‘재설정’에서 운영진에게 받은 코드로 새로 정해 주세요.");
      if (s.secret !== secret) throw new Error(failOnce(s));
      Object.assign(s, { failed: 0, lockCount: 0, lockedUntil: null });
      load().currentUid = m.userId; save();
    },
    async register(name, pin) {
      const d = load();
      const m = d.members.find((x) => x.name === name.trim());
      if (!m) throw new Error("명단에 없는 이름이에요. 운영진에게 명단 등록을 요청해 주세요.");
      if (m.userId || m.status !== "unclaimed") throw new Error("이미 가입한 이름이에요. 로그인해 주세요.");
      const err = secretError(pin, "pin");
      if (err) throw new Error(err);
      m.userId = `u-${m.id}`; m.status = "pending";
      d.secrets![m.id] = { secret: pin, kind: "pin", failed: 0, lockCount: 0, lockedUntil: null, resetCode: null };
      d.currentUid = m.userId; save();
    },
    async resetWithCode(name, code, secret) {
      const m = byName(name);
      const s = m && load().secrets![m.id];
      if (!m || !s || !s.resetCode) throw new Error("이름 또는 재설정 코드가 맞지 않아요.");
      if (s.resetCode !== code.trim()) throw new Error(failOnce(s));
      const err = secretError(secret, kindFor(m));
      if (err) throw new Error(err);
      Object.assign(s, { secret, kind: kindFor(m), failed: 0, lockCount: 0, lockedUntil: null, resetCode: null });
      load().currentUid = m.userId; save();
    },
    async changeSecret(current, next) {
      const m = me();
      const s = m && load().secrets![m.id];
      if (!m || !s) throw new Error("다시 로그인해 주세요.");
      if (s.secret !== current) { failOnce(s); throw new Error("지금 비밀번호가 맞지 않아요."); }
      const err = secretError(next, kindFor(m));
      if (err) throw new Error(err);
      Object.assign(s, { secret: next, kind: kindFor(m), failed: 0 });
      save();
    },
    async mySecretKind() {
      const m = me();
      return m ? load().secrets![m.id]?.kind ?? null : null;
    },
    async adminResetSecret(memberId) {
      const d = load();
      const m = d.members.find((x) => x.id === memberId);
      if (!m || !m.userId) throw new Error("아직 가입하지 않은 회원이에요");
      const code = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
      d.secrets![m.id] = { secret: null, kind: kindFor(m), failed: 0, lockCount: 0, lockedUntil: null, resetCode: code };
      save();
      return code;
    },
    async signOut() { load().currentUid = null; save(); },

    async getMe() { const m = me(); return m ? clone(m) : null; },
    async listMembers() { return clone(load().members); },
    async addMember({ name, gender }) {
      load().members.push({ id: nid("m"), name, gender, role: "member", isLeader: false, status: "unclaimed", userId: null, badgeId: null });
      save();
    },
    async updateMember(id, patch) {
      const m = load().members.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
      save();
    },
    async deleteMember(id) {
      const d = load();
      d.members = d.members.filter((m) => m.id !== id);
      d.attendance = d.attendance.filter((a) => a.memberId !== id);
      save();
    },
    async cancelJoin() {
      const m = me();
      if (m && m.status === "pending") { delete load().secrets![m.id]; m.status = "unclaimed"; m.userId = null; save(); }
    },
    async reviewJoin(memberId, approve) {
      const m = load().members.find((x) => x.id === memberId);
      if (!m) return;
      if (approve) m.status = "active"; else { delete load().secrets![m.id]; m.status = "unclaimed"; m.userId = null; }
      save();
    },

    async claimBadges() {
      const d = load();
      if (!d.myBadges) {
        const now = new Date().toISOString();
        // 처음 열면: 2개는 이미 얻은 상태, 2개는 새로 얻어 팝업으로 보여 줌
        d.myBadges = DEMO_IDS.map((id, i) => ({ id, earnedAt: now, seen: i < 2 }));
        save();
      }
      return d.myBadges.filter((b) => !b.seen).map((b) => ({ id: b.id, ...DEMO_BADGES[b.id] }));
    },
    async markBadgesSeen(ids) {
      const d = load();
      for (const b of d.myBadges ?? []) if (ids.includes(b.id)) b.seen = true;
      save();
    },
    async myBadges() {
      const d = load();
      return { earned: (d.myBadges ?? []).map((b) => ({ id: b.id, ...DEMO_BADGES[b.id], earnedAt: b.earnedAt })), total: DEMO_TOTAL };
    },
    async setMyBadge(id) {
      const m = me();
      if (!m) throw new Error("로그인이 필요해요");
      if (id && !(load().myBadges ?? []).some((b) => b.id === id)) throw new Error("아직 얻지 못한 아이콘이에요");
      m.badgeId = id; save();
    },

    async getSettings() { const s = clone(load().settings); return { ...s, instagram: s.instagram ?? "" }; },
    async updateSettings(s) { load().settings = { ...s }; save(); },

    async listEvents(from, to) {
      return clone(load().events.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date)));
    },
    async getEvent(id) { const e = load().events.find((x) => x.id === id); return e ? clone(e) : null; },
    async createEvent(e, attendees = []) {
      const d = load();
      if (e.kind === "social" && d.events.filter((x) => x.kind === "social" && x.date.slice(0, 7) === e.date.slice(0, 7)).length >= SOCIAL_PER_MONTH) {
        throw new Error(`친목 일정은 한 달에 ${SOCIAL_PER_MONTH}회까지 등록할 수 있어요`);
      }
      const id = nid("e");
      d.events.push({ id, ...e });
      d.attendance.push(...attendees.map((memberId) => ({ eventId: id, memberId })));
      save();
      return id;
    },
    async deleteEvent(id) {
      const d = load();
      d.events = d.events.filter((e) => e.id !== id);
      d.attendance = d.attendance.filter((a) => a.eventId !== id);
      save();
    },
    async listAttendance(q) {
      return load().attendance
        .map((a): AttendanceRow => ({ ...a, date: eventDate(a.eventId), kind: load().events.find((e) => e.id === a.eventId)?.kind ?? "etc" }))
        .filter((a) => a.date
          && (!q.from || a.date >= q.from) && (!q.to || a.date <= q.to)
          && (!q.memberId || a.memberId === q.memberId) && (!q.eventId || a.eventId === q.eventId));
    },
    async setAttendance(eventId, memberIds) {
      const d = load();
      d.attendance = d.attendance.filter((a) => a.eventId !== eventId).concat(memberIds.map((memberId) => ({ eventId, memberId })));
      save();
    },

    async listDistance(q) {
      return clone(load().distance.filter((d) =>
        (!q.fromMonth || d.month >= q.fromMonth) && (!q.toMonth || d.month <= q.toMonth)
        && (!q.memberId || d.memberId === q.memberId) && (!q.status || d.status === q.status)));
    },
    async submitDistance({ month, km, photo }) {
      const m = me();
      if (!m) throw new Error("로그인이 필요해요");
      // 데모: 새로고침해도 보이도록 작은 미리보기를 data URL 로 저장
      const path = await toDataUrl(photo, 480).catch(() => null);
      load().distance.push({ id: nid("d"), memberId: m.id, month, km, photoPath: path, status: "pending", createdAt: new Date().toISOString() });
      save();
    },
    async reviewDistance(id, approve) {
      const s = load().distance.find((d) => d.id === id);
      if (s) s.status = approve ? "approved" : "rejected";
      save();
    },
    async getPhotoUrl(path) { return path.startsWith("data:") ? path : null; },

    async listAnnouncements() {
      const d = load();
      if (!d.announcements) {
        const until = new Date(); until.setDate(until.getDate() + 7);
        d.announcements = [{
          id: "a-demo-1", title: "11월 정기런 장소 안내",
          body: "이번 달 월요 정기런은 한강공원 반포지구 달빛광장에서 저녁 8시에 출발해요.\n물과 간단한 간식은 크루에서 준비합니다!",
          popupUntil: dateStr(until), createdAt: new Date().toISOString(),
        }];
        save();
      }
      return clone(d.announcements).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async createAnnouncement({ title, body, popupUntil }) {
      const d = load();
      const id = nid("a");
      d.announcements = [...(d.announcements ?? []), { id, title, body, popupUntil, createdAt: new Date().toISOString() }];
      save();
      return id;
    },
    async deleteAnnouncement(id) {
      const d = load();
      d.announcements = (d.announcements ?? []).filter((a) => a.id !== id);
      save();
    },

    async listRaceRecords(q) {
      return clone(load().races.filter((r) =>
        (!q.year || r.raceDate.startsWith(String(q.year))) && (!q.memberId || r.memberId === q.memberId)));
    },
    async addRaceRecord(r) {
      const m = me();
      if (!m) throw new Error("로그인이 필요해요");
      load().races.push({ id: nid("r"), memberId: m.id, ...r });
      save();
    },
    async deleteRaceRecord(id) {
      const d = load();
      d.races = d.races.filter((r) => r.id !== id);
      save();
    },
  };
}
