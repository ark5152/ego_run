import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Api, AttendanceRow, CrewEvent, DistanceSubmission, Member, RaceRecord, Settings,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const toMember = (r: any): Member => ({
  id: r.id, name: r.name, gender: r.gender, role: r.role, isLeader: r.is_leader, status: r.status, userId: r.user_id,
});
const toEvent = (r: any): CrewEvent => ({ id: r.id, date: r.date, title: r.title, kind: r.kind });
const toDistance = (r: any): DistanceSubmission => ({
  id: r.id, memberId: r.member_id, month: r.month, km: Number(r.km), photoPath: r.photo_path, status: r.status, createdAt: r.created_at,
});
const toRace = (r: any): RaceRecord => ({
  id: r.id, memberId: r.member_id, course: r.course, seconds: r.seconds, raceName: r.race_name, raceDate: r.race_date,
});

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** PostgREST 는 한 번에 최대 1000행 → 끝까지 페이지를 넘겨 모두 가져온다 */
async function fetchAll(build: () => any): Promise<any[]> {
  const size = 1000;
  const out: any[] = [];
  for (let from = 0; ; from += size) {
    const rows = check(await build().range(from, from + size - 1)) as any[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;

  return {
    mode: "supabase",

    async getSession() {
      const s = (await sb.auth.getSession()).data.session;
      return s ? { userId: s.user.id, email: s.user.email ?? null } : null;
    },
    async sendLoginCode(email) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) throw new Error(error.message);
    },
    async verifyLoginCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async getMe() {
      const id = await uid();
      if (!id) return null;
      const r = check(await sb.from("members").select("*").eq("user_id", id).maybeSingle());
      return r ? toMember(r) : null;
    },
    async listMembers() {
      return (await fetchAll(() => sb.from("members").select("*").order("name"))).map(toMember);
    },
    async addMember({ name, gender }) {
      check(await sb.from("members").insert({ name, gender }));
    },
    async updateMember(id, p) {
      const row: any = {};
      if (p.name !== undefined) row.name = p.name;
      if (p.gender !== undefined) row.gender = p.gender;
      if (p.role !== undefined) row.role = p.role;
      if (p.isLeader !== undefined) row.is_leader = p.isLeader;
      check(await sb.from("members").update(row).eq("id", id));
    },
    async deleteMember(id) {
      check(await sb.from("members").delete().eq("id", id));
    },
    async requestJoin(memberId) {
      check(await sb.rpc("request_join", { p_member_id: memberId }));
    },
    async cancelJoin() {
      check(await sb.rpc("cancel_join"));
    },
    async reviewJoin(memberId, approve) {
      check(await sb.rpc("review_join", { p_member_id: memberId, p_approve: approve }));
    },

    async getSettings(): Promise<Settings> {
      const r: any = check(await sb.from("settings").select("*").eq("id", 1).single());
      return { minAttendance: r.min_attendance, distanceTarget: Number(r.distance_target), instagram: r.instagram ?? "" };
    },
    async updateSettings(s) {
      check(await sb.from("settings").update({ min_attendance: s.minAttendance, distance_target: s.distanceTarget, instagram: s.instagram }).eq("id", 1));
    },

    async listEvents(from, to) {
      return (await fetchAll(() => sb.from("events").select("*").gte("date", from).lte("date", to).order("date"))).map(toEvent);
    },
    async getEvent(id) {
      const r = check(await sb.from("events").select("*").eq("id", id).maybeSingle());
      return r ? toEvent(r) : null;
    },
    async createEvent(e) {
      check(await sb.from("events").insert(e));
    },
    async deleteEvent(id) {
      check(await sb.from("events").delete().eq("id", id));
    },
    async listAttendance(q) {
      const rows = await fetchAll(() => {
        let b = sb.from("attendance").select("event_id, member_id, events!inner(date)");
        if (q.from) b = b.gte("events.date", q.from);
        if (q.to) b = b.lte("events.date", q.to);
        if (q.memberId) b = b.eq("member_id", q.memberId);
        if (q.eventId) b = b.eq("event_id", q.eventId);
        return b.order("event_id").order("member_id");
      });
      return rows.map((r): AttendanceRow => ({ eventId: r.event_id, memberId: r.member_id, date: r.events.date }));
    },
    async setAttendance(eventId, memberIds) {
      check(await sb.rpc("set_attendance", { p_event_id: eventId, p_member_ids: memberIds }));
    },

    async listDistance(q) {
      const rows = await fetchAll(() => {
        let b = sb.from("distance_submissions").select("*");
        if (q.fromMonth) b = b.gte("month", q.fromMonth);
        if (q.toMonth) b = b.lte("month", q.toMonth);
        if (q.memberId) b = b.eq("member_id", q.memberId);
        if (q.status) b = b.eq("status", q.status);
        return b.order("created_at");
      });
      return rows.map(toDistance);
    },
    async submitDistance({ month, km, photo }) {
      const id = await uid();
      const me = id && check(await sb.from("members").select("id").eq("user_id", id).single());
      if (!id || !me) throw new Error("로그인이 필요해요");
      const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${id}/${Date.now()}.${ext || "jpg"}`;
      const up = await sb.storage.from("distance-photos").upload(path, photo, { contentType: photo.type || undefined });
      if (up.error) throw new Error(up.error.message);
      check(await sb.from("distance_submissions").insert({ member_id: (me as any).id, month, km, photo_path: path }));
    },
    async reviewDistance(id, approve) {
      check(await sb.from("distance_submissions")
        .update({ status: approve ? "approved" : "rejected", reviewed_at: new Date().toISOString() }).eq("id", id));
    },
    async getPhotoUrl(path) {
      const { data } = await sb.storage.from("distance-photos").createSignedUrl(path, 600);
      return data?.signedUrl ?? null;
    },

    async listRaceRecords(q) {
      const rows = await fetchAll(() => {
        let b = sb.from("race_records").select("*");
        if (q.year) b = b.gte("race_date", `${q.year}-01-01`).lte("race_date", `${q.year}-12-31`);
        if (q.memberId) b = b.eq("member_id", q.memberId);
        return b.order("seconds");
      });
      return rows.map(toRace);
    },
    async addRaceRecord(r) {
      const id = await uid();
      const me: any = id && check(await sb.from("members").select("id").eq("user_id", id).single());
      if (!me) throw new Error("로그인이 필요해요");
      check(await sb.from("race_records").insert({
        member_id: me.id, course: r.course, seconds: r.seconds, race_name: r.raceName, race_date: r.raceDate,
      }));
    },
    async deleteRaceRecord(id) {
      check(await sb.from("race_records").delete().eq("id", id));
    },
  };
}
