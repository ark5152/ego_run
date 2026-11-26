export type Gender = "M" | "F";
export type Role = "member" | "admin";
export type MemberStatus = "unclaimed" | "pending" | "active";

export interface Member {
  id: string;
  name: string;
  gender: Gender;
  role: Role;
  isLeader: boolean; // 크루장 태그
  status: MemberStatus;
  userId: string | null;
  badgeId: string | null; // 대표 아이콘(없으면 null)
  approvedAt: string | null; // 가입 승인 시각(신입 판단용)
}

/** 획득한 아이콘. 이름·설명은 얻은 뒤에만 서버에서 받음 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt?: string;
}

/** 아이콘 이미지: 기본 88px(팝업·선택 화면), 28px(홈 이름 칸), 22px(참석 랭킹) — 작은 칸은 그 크기로 그린 도트를 써서 선명하게 */
export const badgeImage = (id: string, size?: 22 | 28) => `/badges/${id}${size ? `-${size}` : ""}.png`;

/** "한복을", "나무를" — 이름 끝 받침에 맞는 조사 */
export function objParticle(name: string): string {
  const ch = name.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? "을" : "를";
  if (code >= 0x3131 && code <= 0x314e) return "을";
  return "을(를)";
}

export type EventKind = "run" | "event" | "social" | "etc";

export const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: "run", label: "러닝" },
  { value: "event", label: "행사·대회" },
  { value: "social", label: "친목" },
  { value: "etc", label: "기타" },
];
/** 친목 일정은 매월 3회까지(이월 없음) */
export const SOCIAL_PER_MONTH = 3;

export const kindLabel = (k: EventKind) => EVENT_KINDS.find((x) => x.value === k)?.label ?? "기타";

/** 크루장·관리자를 하나로 묶어 부르는 이름 */
export const isStaff = (m: { role: Role; isLeader: boolean }) => m.role === "admin" || m.isLeader;

export interface CrewEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  kind: EventKind;
}

export interface AttendanceRow {
  eventId: string;
  memberId: string;
  date: string; // event date, YYYY-MM-DD
  kind: EventKind; // 일정 구분 — 출석 횟수는 '러닝'만 셈
}

/** 출석 횟수에 들어가는 일정: 구분이 '러닝'인 것만 */
export const countsAsAttendance = (a: { kind: EventKind }) => a.kind === "run";

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface DistanceSubmission {
  id: string;
  memberId: string;
  month: string; // YYYY-MM
  km: number;
  photoPath: string | null;
  status: ReviewStatus;
  createdAt: string;
}

export type Course = "full" | "half" | "10k";

export interface RaceRecord {
  id: string;
  memberId: string;
  course: Course;
  seconds: number;
  raceName: string;
  raceDate: string; // YYYY-MM-DD
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  popupUntil: string; // YYYY-MM-DD, 이 날까지 앱을 열면 팝업
  createdAt: string;
}

export interface Settings {
  minAttendance: number; // 월 최소 참석 횟수
  distanceTarget: number; // 월 거리 인증 목표(km)
  instagram: string; // 크루 인스타그램 계정(@ 없이), 비어 있으면 미등록
  newbieStart: string; // 이 날짜(YYYY-MM-DD) 이후 승인된 회원부터 신입 규칙 적용
}

/** 한국 시간 기준 날짜(YYYY-MM-DD) */
const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);

/** 신입: 가입이 승인된 그 달(month = YYYY-MM)에는 참석·거리 기준 판단에서 뺌 */
export function isNewbie(m: Pick<Member, "approvedAt">, month: string, s: Pick<Settings, "newbieStart">): boolean {
  if (!m.approvedAt) return false;
  const d = kstDate(m.approvedAt);
  return d >= s.newbieStart && d.slice(0, 7) === month;
}

export interface Session {
  userId: string;
}

/** 비밀번호 종류: 크루원은 숫자 4자리(pin), 운영진은 영문+숫자 8자리 이상(password) */
export type SecretKind = "pin" | "password";

export interface Api {
  mode: "supabase" | "demo";

  // auth
  getSession(): Promise<Session | null>;
  /** 이름 + 비밀번호 로그인 */
  login(name: string, secret: string): Promise<void>;
  /** 처음 가입: 명단의 이름 + 숫자 4자리 → 승인 대기 */
  register(name: string, pin: string): Promise<void>;
  /** 운영진에게 받은 재설정 코드로 새 비밀번호 */
  resetWithCode(name: string, code: string, secret: string): Promise<void>;
  /** 로그인한 본인의 비밀번호 변경 */
  changeSecret(current: string, next: string): Promise<void>;
  mySecretKind(): Promise<SecretKind | null>;
  /** 운영진: 비밀번호 초기화 → 6자리 재설정 코드 */
  adminResetSecret(memberId: string): Promise<string>;
  signOut(): Promise<void>;

  // members
  getMe(): Promise<Member | null>;
  listMembers(): Promise<Member[]>;
  addMember(input: { name: string; gender: Gender }): Promise<void>;
  updateMember(id: string, patch: Partial<Pick<Member, "name" | "gender" | "role" | "isLeader">>): Promise<void>;
  deleteMember(id: string): Promise<void>;
  cancelJoin(): Promise<void>;
  reviewJoin(memberId: string, approve: boolean): Promise<void>;

  // settings
  getSettings(): Promise<Settings>;
  updateSettings(s: Settings): Promise<void>;

  // events & attendance
  listEvents(from: string, to: string): Promise<CrewEvent[]>;
  getEvent(id: string): Promise<CrewEvent | null>;
  /** 만든 일정의 id 를 돌려줌 */
  createEvent(input: Omit<CrewEvent, "id">, attendees?: string[]): Promise<string>;
  deleteEvent(id: string): Promise<void>;
  listAttendance(q: { from?: string; to?: string; memberId?: string; eventId?: string }): Promise<AttendanceRow[]>;
  setAttendance(eventId: string, memberIds: string[]): Promise<void>;

  // distance
  listDistance(q: { fromMonth?: string; toMonth?: string; memberId?: string; status?: ReviewStatus }): Promise<DistanceSubmission[]>;
  submitDistance(input: { month: string; km: number; photo: File }): Promise<void>;
  reviewDistance(id: string, approve: boolean): Promise<void>;
  getPhotoUrl(path: string): Promise<string | null>;

  // announcements
  listAnnouncements(): Promise<Announcement[]>;
  /** 만든 공지의 id 를 돌려줌 */
  createAnnouncement(input: { title: string; body: string; popupUntil: string }): Promise<string>;
  deleteAnnouncement(id: string): Promise<void>;

  // badges(아이콘)
  /** 새로 조건을 채운 아이콘을 지급하고, 아직 팝업을 안 본 아이콘을 돌려줌 */
  claimBadges(): Promise<Badge[]>;
  markBadgesSeen(ids: string[]): Promise<void>;
  myBadges(): Promise<{ earned: Badge[]; total: number }>;
  setMyBadge(id: string | null): Promise<void>;

  // races
  listRaceRecords(q: { year?: number; memberId?: string }): Promise<RaceRecord[]>;
  addRaceRecord(input: Omit<RaceRecord, "id" | "memberId">): Promise<void>;
  deleteRaceRecord(id: string): Promise<void>;
}

/** 비밀번호 규칙(서버의 secret_error 와 같은 규칙 — 화면에서 미리 안내용) */
export function secretError(secret: string, kind: SecretKind): string | null {
  if (kind === "pin") {
    if (!/^\d{4}$/.test(secret)) return "비밀번호는 숫자 4자리로 정해 주세요";
    if (/^(\d)\1{3}$/.test(secret) || "0123456789".includes(secret) || "9876543210".includes(secret)) {
      return "1111, 1234처럼 쉬운 번호는 쓸 수 없어요";
    }
    return null;
  }
  if (secret.length < 8 || !/[A-Za-z]/.test(secret) || !/\d/.test(secret)) {
    return "운영진 비밀번호는 영문과 숫자를 섞어 8자리 이상으로 정해 주세요";
  }
  return null;
}
