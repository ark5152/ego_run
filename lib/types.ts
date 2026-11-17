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
}

export type EventKind = "run" | "event" | "social" | "etc";

export const EVENT_KINDS: { value: EventKind; label: string }[] = [
  { value: "run", label: "러닝" },
  { value: "event", label: "행사·대회" },
  { value: "social", label: "친목" },
  { value: "etc", label: "기타" },
];
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
}

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

export interface Settings {
  minAttendance: number; // 월 최소 참석 횟수
  distanceTarget: number; // 월 거리 인증 목표(km)
  instagram: string; // 크루 인스타그램 계정(@ 없이), 비어 있으면 미등록
}

export interface Session {
  userId: string;
  email: string | null;
}

export interface Api {
  mode: "supabase" | "demo";

  // auth
  getSession(): Promise<Session | null>;
  sendLoginCode(email: string): Promise<void>;
  verifyLoginCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  // members
  getMe(): Promise<Member | null>;
  listMembers(): Promise<Member[]>;
  addMember(input: { name: string; gender: Gender }): Promise<void>;
  updateMember(id: string, patch: Partial<Pick<Member, "name" | "gender" | "role" | "isLeader">>): Promise<void>;
  deleteMember(id: string): Promise<void>;
  requestJoin(memberId: string): Promise<void>;
  cancelJoin(): Promise<void>;
  reviewJoin(memberId: string, approve: boolean): Promise<void>;

  // settings
  getSettings(): Promise<Settings>;
  updateSettings(s: Settings): Promise<void>;

  // events & attendance
  listEvents(from: string, to: string): Promise<CrewEvent[]>;
  getEvent(id: string): Promise<CrewEvent | null>;
  createEvent(input: Omit<CrewEvent, "id">): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  listAttendance(q: { from?: string; to?: string; memberId?: string; eventId?: string }): Promise<AttendanceRow[]>;
  setAttendance(eventId: string, memberIds: string[]): Promise<void>;

  // distance
  listDistance(q: { fromMonth?: string; toMonth?: string; memberId?: string; status?: ReviewStatus }): Promise<DistanceSubmission[]>;
  submitDistance(input: { month: string; km: number; photo: File }): Promise<void>;
  reviewDistance(id: string, approve: boolean): Promise<void>;
  getPhotoUrl(path: string): Promise<string | null>;

  // races
  listRaceRecords(q: { year?: number; memberId?: string }): Promise<RaceRecord[]>;
  addRaceRecord(input: Omit<RaceRecord, "id" | "memberId">): Promise<void>;
  deleteRaceRecord(id: string): Promise<void>;
}
