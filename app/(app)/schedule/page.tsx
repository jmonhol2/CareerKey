"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import AppNav from "@/components/AppNav";
import RequirePermission from "@/components/RequirePermission";
import { formatEventDateTime, type RecruitingEvent } from "@/lib/events";
import { locationPreferenceMatches } from "@/lib/usStates";

type Company = {
  id: string;
  company_name: string;
  time_slots?: CompanyTimeSlot[] | null;
};

type CompanyTimeSlot = {
  id: string;
  event_id: string | null;
  company_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
};

type Slot = {
  id: string;
  event_id: string | null;
  company_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
};

type CompanyProfile = {
  company_id: string;
  short_description: string | null;
  long_description: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  rating: number | null;
  review_count: number | null;
  headquarters: string | null;
  company_size: string | null;
  hiring_types: string[] | null;
  majors: string[] | null;
  skills: string[] | null;
  last_refreshed_at: string | null;
};

type CompanyPosition = {
  id: string;
  company_id: string;
  title: string;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  location_label: string | null;
  work_mode: "On-site" | "Hybrid" | "Remote" | null;
  openings: number;
  majors: string[] | null;
  skills: string[] | null;
  description: string | null;
};

type StudentProfile = {
  user_id: string;
  display_name: string | null;
  major: string | null;
  class_year: string | null;
  gpa: number | null;
  work_authorization: string | null;
  open_to_relocation: boolean | null;
  preferred_locations: string[] | null;
  interested_role_types: string[] | null;
  preferred_work_modes: string[] | null;
  industries_of_interest: string[] | null;
  skills: string[] | null;
  bio: string | null;
};

type BookedAppointment = {
  id: string;
  slotId: string;
  companyId: string;
  companyName: string;
  startTime: string;
  endTime: string;
  personnelName: string;
  personnelRole: string;
};

type PersonnelOption = {
  id: string;
  name: string;
  roleTitle: string;
  bio: string | null;
};

type PersonnelAvailabilityRow = {
  slot_id: string;
  personnel_id: string;
  personnel_name: string;
  role_title: string;
  bio: string | null;
};

type RecommendedSlot = {
  id: string;
  companyId: string;
  companyName: string;
  start_time: string;
  end_time: string;
  matchScore: number;
};

type GapRange = {
  start: string;
  end: string;
};

type AppointmentSlotJoin = {
  id: string;
  event_id: string | null;
  company_id: string;
  start_time: string;
  end_time: string;
  company:
    | {
        id: string;
        company_name: string;
      }
    | {
        id: string;
        company_name: string;
      }[]
    | null;
};

type BookedAppointmentRow = {
  id: string;
  status: string;
  slot: AppointmentSlotJoin | AppointmentSlotJoin[] | null;
  personnel:
    | { name: string; role_title: string }
    | { name: string; role_title: string }[]
    | null;
};

type CompanyJoin = {
    id: string;
    company_name: string;
  };

function normalizeJoinedSlot(slot: BookedAppointmentRow["slot"]) {
  if (!slot) return null;
  const normalizedSlot = Array.isArray(slot) ? slot[0] : slot;
  if (!normalizedSlot) return null;

  const normalizedCompany = Array.isArray(normalizedSlot.company)
    ? normalizedSlot.company[0]
    : normalizedSlot.company;

  return {
    ...normalizedSlot,
    company: (normalizedCompany ?? null) as CompanyJoin | null,
  };
};

type RenderedCompany = Company & { score: number };

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function computePositionMatch(position: CompanyPosition, profile: StudentProfile | null) {
  if (!profile) {
    return {
      score: 0,
      reasons: ["Complete your profile to see a match score."],
    };
  }

  let score = 0;
  const reasons: string[] = [];
  const studentSkills = normalizeList(profile.skills);
  const positionSkills = normalizeList(position.skills);

  if (positionSkills.length > 0) {
    const matchedSkills = positionSkills.filter((skill) => studentSkills.includes(skill));
    score += Math.round((matchedSkills.length / positionSkills.length) * 35);

    if (matchedSkills.length > 0) reasons.push(`matched skills: ${matchedSkills.join(", ")}`);
  }

  const studentMajor = profile.major?.trim().toLowerCase();
  const positionMajors = normalizeList(position.majors);

  if (studentMajor && positionMajors.length > 0) {
    const exactMajorMatch = positionMajors.some((major) => major === studentMajor);
    const partialMajorMatch = positionMajors.some(
      (major) => major.includes(studentMajor) || studentMajor.includes(major)
    );

    if (exactMajorMatch) {
      score += 25;
      reasons.push("major aligns strongly");
    } else if (partialMajorMatch) {
      score += 15;
      reasons.push("major partially aligns");
    }
  }

  const preferredLocations = normalizeList(profile.preferred_locations);
  const positionLocation = (
    position.location_label ||
    [position.location_city, position.location_state].filter(Boolean).join(", ")
  )
    .trim()
    .toLowerCase();

  if (profile.open_to_relocation) {
    score += 20;
    reasons.push("open to opportunities anywhere");
  } else if (positionLocation) {
    const exactLocation = preferredLocations.some((location) =>
      locationPreferenceMatches(
        location,
        positionLocation,
        position.location_state
      )
    );
    if (exactLocation) {
      score += 20;
      reasons.push("preferred location match");
    }
  }

  const preferredWorkModes = normalizeList(profile.preferred_work_modes);
  const positionWorkMode = position.work_mode?.trim().toLowerCase();

  if (positionWorkMode && preferredWorkModes.includes(positionWorkMode)) {
    score += 10;
    reasons.push(`${position.work_mode} work preference match`);
  }

  const roleTypes = normalizeList(profile.interested_role_types);
  const titleAndDescription = `${position.title} ${position.description ?? ""}`.toLowerCase();
  const matchedRoleType = roleTypes.find((roleType) => titleAndDescription.includes(roleType));

  if (matchedRoleType) {
    score += 10;
    reasons.push(`${matchedRoleType} interest match`);
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons.length ? reasons : ["Limited profile overlap so far."],
  };
}

function getDefaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getOrInitTimeZone(): string {
  const key = "careerkey_timezone";
  const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  return saved || getDefaultTimeZone();
}

export default function SchedulePage() {
  return (
    <RequirePermission permission="student.portal">
      <Suspense fallback={<main className="container">Loading schedule...</main>}>
        <SchedulePageContent />
      </Suspense>
    </RequirePermission>
  );
}

function SchedulePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdFromUrl = searchParams.get("companyId");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeEvent, setActiveEvent] = useState<RecruitingEvent | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [positions, setPositions] = useState<CompanyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [companyMatchScores, setCompanyMatchScores] = useState<Record<string, number>>({});
  const [filterMode, setFilterMode] = useState<"matches" | "all">("matches");
  const [showMore, setShowMore] = useState(false);
  const [bookedAppointments, setBookedAppointments] = useState<BookedAppointment[]>([]);
  const [personnelBySlot, setPersonnelBySlot] = useState<Record<string, PersonnelOption[]>>({});
  const [selectedPersonnelBySlot, setSelectedPersonnelBySlot] = useState<Record<string, string>>({});

  // Timezone selector (defaults to user's timezone, persisted in localStorage)
  const [timeZone, setTimeZone] = useState<string>(getOrInitTimeZone());

  useEffect(() => {
    localStorage.setItem("careerkey_timezone", timeZone);
  }, [timeZone]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const totalOpenings = useMemo(
    () => positions.reduce((sum, p) => sum + (p.openings ?? 0), 0),
    [positions]
  );

  const totalRoles = useMemo(() => positions.length, [positions]);

  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();

    for (const p of positions) {
      const label =
        p.location_label ||
        [p.location_city, p.location_state].filter(Boolean).join(", ") ||
        p.work_mode ||
        "Unspecified";

      counts.set(label, (counts.get(label) ?? 0) + (p.openings ?? 0));
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [positions]);

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const matchA = computePositionMatch(a, studentProfile).score;
      const matchB = computePositionMatch(b, studentProfile).score;
      return matchB - matchA;
    });
  }, [positions, studentProfile]);

  const bestCompanyMatch = useMemo(() => {
    if (positions.length === 0) return null;
    return Math.max(...positions.map((p) => computePositionMatch(p, studentProfile).score));
  }, [positions, studentProfile]);

  async function loadActiveEvent() {
    const { data, error } = await supabase
      .from("recruiting_events")
      .select("id, name, start_time, end_time, slot_duration_minutes, timezone, is_active")
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;

    const event = data ? (data as RecruitingEvent) : null;
    setActiveEvent(event);
    return event;
  }

  async function loadCompanies(eventId: string | null) {
    let query = supabase
      .from("companies")
      .select(`
        id,
        company_name,
        time_slots (
          id,
          event_id,
          company_id,
          start_time,
          end_time,
          capacity
        )
      `)
      .order("company_name", { ascending: true });

    if (eventId) query = query.eq("time_slots.event_id", eventId);

    const { data: companyRows, error } = await query;

    if (error) throw error;

    const companies = ((companyRows ?? []) as Company[]).map((company) => ({
      ...company,
      time_slots: eventId ? company.time_slots ?? [] : [],
    }));

    setCompanies(companies);
    if (companyIdFromUrl && companies.some((c) => c.id === companyIdFromUrl)) {
      setSelectedCompanyId(companyIdFromUrl);
    } else if (!selectedCompanyId && companies.length) {
      setSelectedCompanyId(companies[0].id);
    }
  }

  async function loadSlots(companyId: string, eventId: string) {
    const { data: slotRows, error: slotErr } = await supabase
      .from("time_slots")
      .select("id, event_id, company_id, start_time, end_time, capacity")
      .eq("company_id", companyId)
      .eq("event_id", eventId)
      .order("start_time");

    if (slotErr) throw slotErr;

    const slotIds = (slotRows ?? []).map((s) => s.id);
    const bookedMap = new Map<string, number>();

    if (slotIds.length > 0) {
      const { data: apptRows, error: apptErr } = await supabase
        .from("appointments")
        .select("slot_id")
        .in("slot_id", slotIds)
        .eq("status", "booked");

      if (apptErr) throw apptErr;

      for (const r of apptRows ?? []) {
        bookedMap.set(r.slot_id, (bookedMap.get(r.slot_id) ?? 0) + 1);
      }
    }

    const merged: Slot[] = ((slotRows ?? []) as Array<Omit<Slot, "booked">>).map((s) => ({
      ...s,
      booked: bookedMap.get(s.id) ?? 0,
    }));

    const { data: availabilityRows, error: availabilityError } = await supabase.rpc(
      "get_company_event_personnel_availability",
      { requested_company_id: companyId, requested_event_id: eventId }
    );

    if (availabilityError) throw availabilityError;

    const availability: Record<string, PersonnelOption[]> = {};
    for (const row of (availabilityRows ?? []) as PersonnelAvailabilityRow[]) {
      const slotPersonnel = availability[row.slot_id] ?? [];
      slotPersonnel.push({
        id: row.personnel_id,
        name: row.personnel_name,
        roleTitle: row.role_title,
        bio: row.bio,
      });
      availability[row.slot_id] = slotPersonnel;
    }

    setSlots(merged);
    setPersonnelBySlot(availability);
  }

  async function loadCompanyProfile(companyId: string) {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;

    setCompanyProfile(data ?? null);
    setShowMore(false);
  }

  async function loadPositions(companyId: string) {
    const { data, error } = await supabase
      .from("company_positions")
      .select("*")
      .eq("company_id", companyId)
      .order("title");

    if (error) throw error;

    setPositions(data ?? []);
  }

  async function loadStudentProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStudentProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    const profile = (data as StudentProfile | null) ?? null;
    setStudentProfile(profile);
    return profile;
  }

  async function loadCompanyMatchScores(profile: StudentProfile | null) {
    if (!profile) {
      setCompanyMatchScores({});
      return;
    }

    const { data, error } = await supabase
      .from("company_positions")
      .select("*");

    if (error) throw error;

    const scores: Record<string, number> = {};

    for (const position of (data as CompanyPosition[]) ?? []) {
      const score = computePositionMatch(position, profile).score;
      const currentBest = scores[position.company_id] ?? 0;
      if (score > currentBest) {
        scores[position.company_id] = score;
      }
    }

    setCompanyMatchScores(scores);
  }

  async function loadBookedAppointments(eventId: string | null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBookedAppointments([]);
      return;
    }

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        status,
        personnel:company_personnel (
          name,
          role_title
        ),
        slot:time_slots (
          id,
          event_id,
          company_id,
          start_time,
          end_time,
          company:companies (
            id,
            company_name
          )
        )
      `)
      .eq("student_id", user.id)
      .eq("status", "booked");

    if (error) {
      console.error("Failed to load booked appointments:", error);
      setBookedAppointments([]);
      return;
    }

    const rows = (data as unknown as BookedAppointmentRow[] | null) ?? [];

    const normalized = rows
        .flatMap((appt) => {
          const slot = normalizeJoinedSlot(appt.slot);
          if (!eventId || !slot || slot.event_id !== eventId) return [];
          const personnel = Array.isArray(appt.personnel)
            ? appt.personnel[0]
            : appt.personnel;

          return [{
            id: appt.id,
            slotId: slot.id,
            companyId: slot.company_id,
            companyName: slot.company?.company_name ?? "Unknown Company",
            startTime: slot.start_time,
            endTime: slot.end_time,
            personnelName: personnel?.name ?? "Personnel not assigned",
            personnelRole: personnel?.role_title ?? "",
          }];
        })
        .sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        ) ?? [];

    setBookedAppointments(normalized);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const event = await loadActiveEvent();
        await Promise.all([
          loadCompanies(event?.id ?? null),
          loadBookedAppointments(event?.id ?? null),
        ]);
        const profile = await loadStudentProfile();
        await loadCompanyMatchScores(profile);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load page data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

useEffect(() => {
  if (!selectedCompanyId || !activeEvent) {
    return;
  }

  (async () => {
    try {
      setError(null);
      setShowMore(false);

      await Promise.all([
         loadSlots(selectedCompanyId, activeEvent.id),
         loadCompanyProfile(selectedCompanyId),
         loadPositions(selectedCompanyId),
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load company data");
    }
  })();
}, [activeEvent, selectedCompanyId]);

  async function bookSlot(slotId: string, personnelId: string) {
    try {
      setBookingId(slotId);
      setError(null);

      const { data, error } = await supabase.rpc("book_personnel_slot", {
        p_slot_id: slotId,
        p_personnel_id: personnelId,
      });

      if (error) {
        setError(`Booking failed: ${error.message}`);
        return;
      }

      if (selectedCompanyId && activeEvent) {
        await loadSlots(selectedCompanyId, activeEvent.id);
      }
      await loadBookedAppointments(activeEvent?.id ?? null);
      setSelectedPersonnelBySlot((current) => {
        const next = { ...current };
        delete next[slotId];
        return next;
      });
      setError(null);

      router.push(
        `/schedule/confirmation?appointmentId=${encodeURIComponent(
          String(data)
        )}&slotId=${encodeURIComponent(slotId)}&tz=${encodeURIComponent(timeZone)}`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBookingId(null);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });

  function toMinutes(ts: string) {
    const d = new Date(ts);
    return d.getHours() * 60 + d.getMinutes();
  }

  function formatTimeLabel(ts: string) {
    return new Date(ts).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getGapRanges(events: BookedAppointment[]): GapRange[] {
    if (events.length < 2) return [];

    const sorted = [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const gaps: GapRange[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = new Date(sorted[i].endTime).getTime();
      const nextStart = new Date(sorted[i + 1].startTime).getTime();

      if (nextStart > currentEnd) {
        gaps.push({
          start: sorted[i].endTime,
          end: sorted[i + 1].startTime,
        });
      }
    }

    return gaps;
  }

  const renderedCompanies = useMemo<RenderedCompany[]>(() => {
    const matchedCompanies = companies
      .map((company) => ({
        ...company,
        score: companyMatchScores[company.id] ?? 0,
      }))
      .filter((company) => filterMode === "all" || company.score > 0);

    return matchedCompanies;
  }, [companies, companyMatchScores, filterMode]);

  const companySlots = useMemo(() => {
    return slots
      .filter((slot) => slot.company_id === selectedCompany?.id)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
  }, [slots, selectedCompany]);

  const recommendedSlots = useMemo<RecommendedSlot[]>(() => {
    if (!companies.length || !bookedAppointments.length) {
      return [];
    }

    const gaps = getGapRanges(bookedAppointments);

    if (!gaps.length) {
      return [];
    }

    const alreadyBookedSlotIds = new Set(bookedAppointments.map((appt) => appt.slotId));

    const allAvailableSlots = companies.flatMap((company) => {
      const companySlotsWithMeta = (company.time_slots ?? []).map((slot) => ({
        id: slot.id,
        companyId: company.id,
        companyName: company.company_name,
        start_time: slot.start_time,
        end_time: slot.end_time,
        matchScore: companyMatchScores[company.id] ?? 0,
      }));

      return companySlotsWithMeta;
    });

    const fitsGap = (slot: RecommendedSlot) => {
      const slotStart = new Date(slot.start_time).getTime();
      const slotEnd = new Date(slot.end_time).getTime();

      return gaps.some((gap) => {
        const gapStart = new Date(gap.start).getTime();
        const gapEnd = new Date(gap.end).getTime();

        return slotStart >= gapStart && slotEnd <= gapEnd;
      });
    };

    return allAvailableSlots
      .filter((slot) => !alreadyBookedSlotIds.has(slot.id))
      .filter((slot) => fitsGap(slot))
      .sort((a, b) => {
        const scoreDiff = (b.matchScore ?? 0) - (a.matchScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;

        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });
  }, [companies, bookedAppointments, companyMatchScores]);

  const eventTimes = activeEvent
    ? [toMinutes(activeEvent.start_time), toMinutes(activeEvent.end_time)]
    : [];
  const allTimes = bookedAppointments.flatMap((appt) => [
    toMinutes(appt.startTime),
    toMinutes(appt.endTime),
  ]).concat(eventTimes);

  const earliest = allTimes.length ? Math.min(...allTimes) : 9 * 60;
  const latest = allTimes.length ? Math.max(...allTimes) : 17 * 60;
  const TIMELINE_PADDING_MINUTES = activeEvent ? 0 : 60;
  const PIXELS_PER_30_MIN = 84;
  const PIXELS_PER_MINUTE = PIXELS_PER_30_MIN / 30;

  const TIMELINE_START = Math.max(
    0,
    Math.floor(earliest / 30) * 30 - TIMELINE_PADDING_MINUTES
  );
  const TIMELINE_END = Math.min(
    24 * 60,
    Math.ceil(latest / 30) * 30 + TIMELINE_PADDING_MINUTES
  );

  const totalMinutes = Math.max(1, TIMELINE_END - TIMELINE_START);
  const TIMELINE_HEIGHT = Math.max(Math.round(totalMinutes * PIXELS_PER_MINUTE), 420);

  function minuteToY(minute: number) {
    return ((minute - TIMELINE_START) / totalMinutes) * TIMELINE_HEIGHT;
  }

  const timelineHours: number[] = [];
  for (let m = TIMELINE_START; m <= TIMELINE_END; m += 30) {
    timelineHours.push(m);
  }

  const scheduleGaps = getGapRanges(bookedAppointments).map((gap) => ({
    ...gap,
    startMin: toMinutes(gap.start),
    endMin: toMinutes(gap.end),
  }));

  return (
    <div className="container">
      <div className="shell">
        <AppNav />

        <div className="main">
          <div className="kicker">EXPO SCHEDULING</div>
          <h1 className="h1" style={{ fontSize: 32 }}>
            Expo Scheduling
          </h1>
          <p className="p" style={{ marginBottom: 12 }}>
            Select a company, then book an available time slot.
          </p>

          {activeEvent ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="kicker">{activeEvent.name}</div>
              <p className="p" style={{ marginTop: 6 }}>
                {formatEventDateTime(activeEvent.start_time, activeEvent.timezone)} – {formatEventDateTime(activeEvent.end_time, activeEvent.timezone)} · {activeEvent.slot_duration_minutes}-minute appointments
              </p>
            </div>
          ) : !loading ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <strong>Scheduling is not open yet.</strong>
              <p className="p" style={{ marginTop: 6 }}>
                An administrator has not published an active event schedule.
              </p>
            </div>
          ) : null}

          <div style={{ marginBottom: 12 }}>
            <label className="p" style={{ fontSize: 14, marginRight: 8 }}>
              Time zone:
            </label>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              style={fieldStyle}
            >
              <option value={getDefaultTimeZone()}>My time zone (auto)</option>
              <option value="America/New_York">Expo time (America/New_York)</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {loading && <p className="p">Loading…</p>}

          {error && (
            <div className="card" style={{ marginBottom: 16 }}>
              <b>Error:</b> {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px 1fr",
              gap: 16,
            }}
          >
            <section className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Companies</h2>
              <div style={{ marginBottom: 10 }}>
                <label className="p" style={{ fontSize: 13, marginRight: 8 }}>
                  View:
                </label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as "matches" | "all")}
                  style={fieldStyle}
                >
                  <option value="matches">Top Matches Only</option>
                  <option value="all">Show All Listings</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {renderedCompanies.map((c) => {
                  const active = c.id === selectedCompanyId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className="btn"
                      style={{
                        justifyContent: "flex-start",
                        background: active
                          ? "var(--primary-soft)"
                          : "var(--surface)",
                        borderColor: active
                          ? "#9ec7bb"
                          : "var(--border)",
                      }}
                      type="button"
                    >
                      {c.company_name}
                      {filterMode === "matches" && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                          ({c.score}%)
                        </span>
                      )}
                    </button>
                  );
                })}
                {renderedCompanies.length === 0 && (
                  <p className="p" style={{ margin: 0 }}>
                    No matching companies found. Switch to &quot;Show All Listings&quot;.
                  </p>
                )}
              </div>
            </section>

            <section className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>
                Slots {selectedCompany ? `— ${selectedCompany.company_name}` : ""}
              </h2>

              {companyProfile && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {companyProfile.logo_url && (
                        <Image
                          src={companyProfile.logo_url}
                          alt={`${selectedCompany?.company_name} logo`}
                          width={56}
                          height={56}
                          unoptimized
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "contain",
                            borderRadius: 12,
                            marginBottom: 10,
                            background: "white",
                            padding: 6,
                          }}
                        />
                      )}

                      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                        {selectedCompany?.company_name}
                      </div>

                      <div className="p" style={{ marginBottom: 10 }}>
                        {companyProfile.short_description ||
                          "No company summary available yet."}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowMore(true)}
                    >
                      Show more
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Industry
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.industry || "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Open positions
                      </div>
                      <div style={{ fontWeight: 700 }}>{totalOpenings}</div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Listed roles
                      </div>
                      <div style={{ fontWeight: 700 }}>{totalRoles}</div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Best match
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {bestCompanyMatch != null ? `${bestCompanyMatch}%` : "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                        gridColumn: "1 / -1",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Top locations
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {topLocations.length
                          ? topLocations
                              .map(([label, count]) => `${label} (${count})`)
                              .join(", ")
                          : "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--surface-soft)",
                        gridColumn: "1 / -1",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Website
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.website ? (
                          <a href={companyProfile.website} target="_blank" rel="noreferrer">
                            {companyProfile.website}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {companySlots.length === 0 ? (
                <p className="p">No slots found for this company.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {companySlots.map((s) => {
                    const personnelOptions = personnelBySlot[s.id] ?? [];
                    const selectedPersonnelId = selectedPersonnelBySlot[s.id] ?? "";
                    const selectedPersonnel = personnelOptions.find(
                      (personnel) => personnel.id === selectedPersonnelId
                    );
                    const full = personnelOptions.length === 0;
                    return (
                      <div
                        key={s.id}
                        className="card"
                        style={{
                          padding: 14,
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800 }}>
                            {fmt(s.start_time)} → {fmt(s.end_time)}
                          </div>
                          <div className="p" style={{ fontSize: 13 }}>
                            {personnelOptions.length} personnel currently available
                          </div>
                          <label style={{ display: "grid", gap: 5, marginTop: 10 }}>
                            Choose who to meet
                            <select
                              value={selectedPersonnelId}
                              onChange={(event) =>
                                setSelectedPersonnelBySlot((current) => ({
                                  ...current,
                                  [s.id]: event.target.value,
                                }))
                              }
                              disabled={full}
                            >
                              <option value="">
                                {full ? "No personnel available" : "Select personnel"}
                              </option>
                              {personnelOptions.map((personnel) => (
                                <option value={personnel.id} key={personnel.id}>
                                  {personnel.name} — {personnel.roleTitle}
                                </option>
                              ))}
                            </select>
                          </label>
                          {selectedPersonnel && (
                            <div className="personnelChoiceSummary">
                              <strong>{selectedPersonnel.name}</strong>
                              <span>{selectedPersonnel.roleTitle}</span>
                              <p>
                                {selectedPersonnel.bio || "No additional description provided."}
                              </p>
                            </div>
                          )}
                        </div>

                        <button
                          disabled={full || !selectedPersonnelId || bookingId === s.id}
                          onClick={() => bookSlot(s.id, selectedPersonnelId)}
                          className={`btn ${!full ? "btnPrimary" : ""}`}
                          style={{
                            opacity: bookingId === s.id ? 0.7 : 1,
                            cursor: full || !selectedPersonnelId ? "not-allowed" : "pointer",
                          }}
                          type="button"
                        >
                          {bookingId === s.id
                            ? "Booking…"
                            : full
                            ? "Unavailable"
                            : selectedPersonnelId
                              ? "Book meeting"
                              : "Choose personnel"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <section
            style={{
              marginTop: "32px",
              padding: "24px",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              background: "var(--surface)",
              boxShadow: "var(--shadow-soft)",
              backdropFilter: "blur(10px)",
              color: "var(--text)",
            }}
          >
            <h2 style={{ marginBottom: "18px", fontSize: "2rem", fontWeight: 800 }}>
              My Schedule
            </h2>

            {bookedAppointments.length === 0 ? (
              <p className="p">No booked appointments yet.</p>
            ) : (
              <div
                style={{
                  maxHeight: "560px",
                  overflowY: "auto",
                  paddingRight: "6px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "90px 1fr",
                    gap: "18px",
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      height: `${TIMELINE_HEIGHT}px`,
                    }}
                  >
                    {timelineHours.map((minute) => (
                      <div
                        key={minute}
                        style={{
                          position: "absolute",
                          top: `${minuteToY(minute)}px`,
                          transform: "translateY(-50%)",
                          fontSize: "15px",
                          color: "var(--muted)",
                          fontWeight: 500,
                        }}
                      >
                        {formatTimeLabel(
                          new Date(
                            2026,
                            1,
                            19,
                            Math.floor(minute / 60),
                            minute % 60
                          ).toISOString()
                        )}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      position: "relative",
                      height: `${TIMELINE_HEIGHT}px`,
                      border: "1px solid var(--border)",
                      borderRadius: "20px",
                      background: "var(--surface-soft)",
                      overflow: "hidden",
                    }}
                  >
                    {timelineHours.map((minute) => (
                      <div
                        key={minute}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${minuteToY(minute)}px`,
                          borderTop: "1px solid var(--border)",
                        }}
                      />
                    ))}

                    {scheduleGaps.map((gap, idx) => {
                      const top = minuteToY(gap.startMin);
                      const height = Math.max(
                        minuteToY(gap.endMin) - minuteToY(gap.startMin),
                        20
                      );

                      return (
                        <div
                          key={`gap-${idx}`}
                          style={{
                            position: "absolute",
                            left: "14px",
                            right: "14px",
                            top: `${top}px`,
                            height: `${height}px`,
                            borderRadius: "16px",
                            background: "rgba(225, 132, 77, 0.16)",
                            border: "1px dashed rgba(201, 107, 55, 0.58)",
                          }}
                          aria-label="Available time"
                        />
                      );
                    })}

                    {bookedAppointments.map((appt, index) => {
                      const startMin = toMinutes(appt.startTime);
                      const endMin = toMinutes(appt.endTime);

                    const top = minuteToY(startMin);
                    const nextAppt = bookedAppointments[index + 1];
                    const nextTop = nextAppt
                      ? minuteToY(toMinutes(nextAppt.startTime))
                      : null;

                    const height = Math.max(minuteToY(endMin) - minuteToY(startMin), 44);
                    const shrunkHeight = Math.max(height - 8, 35);
                    const maxHeightBeforeNext =
                      nextTop != null ? Math.max(nextTop - top - 6, 22) : shrunkHeight;
                    const visualHeight = Math.min(shrunkHeight, maxHeightBeforeNext);

                      return (
                        <div
                          key={appt.id}
                          style={{
                            position: "absolute",
                            left: "16px",
                            right: "16px",
                            top: `${top}px`,
                            height: `${visualHeight}px`,
                            zIndex: index + 1,
                            borderRadius: "18px",
                            background:
                              "linear-gradient(135deg, #f3b07a 0%, #e1844d 100%)",
                            border: "1px solid #c96b37",
                            padding: "7px 18px",
                            boxSizing: "border-box",
                            overflow: "hidden",
                            boxShadow: "0 8px 20px rgba(201, 107, 55, 0.24)",
                            color: "var(--text)",
                          }}
                        >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            gap: "12px",
                            width: "100%",
                            height: "100%",
                          }}
                        >
                          <div
                            style={{
                              gridColumn: 2,
                              fontWeight: 800,
                              fontSize: "1.1rem",
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "min(360px, 42vw)",
                            }}
                          >
                            <div>{appt.companyName}</div>
                            <div style={{ fontSize: "0.72rem", fontWeight: 650 }}>
                              {appt.personnelName}
                              {appt.personnelRole ? ` · ${appt.personnelRole}` : ""}
                            </div>
                          </div>

                          <div
                            style={{
                              gridColumn: 3,
                              justifySelf: "end",
                              fontSize: "0.92rem",
                              color: "rgba(23, 50, 77, 0.78)",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {formatTimeLabel(appt.startTime)} – {formatTimeLabel(appt.endTime)}
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            style={{
              marginTop: "28px",
              padding: "24px",
              border: "1px solid var(--border)",
              borderRadius: "24px",
              background: "var(--surface)",
              boxShadow: "var(--shadow-soft)",
              backdropFilter: "blur(10px)",
              color: "var(--text)",
            }}
          >
            <h2 style={{ marginBottom: "18px", fontSize: "2rem", fontWeight: 800 }}>
              Recommended to Fill Gaps
            </h2>

            {recommendedSlots.length === 0 ? (
              <p className="p">No recommendations yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {recommendedSlots.map((slot, index) => (
                  <div
                    key={slot.id}
                    style={{
                      padding: "18px 18px",
                      borderRadius: "20px",
                      background:
                        index === 0
                          ? "linear-gradient(135deg, #edf8f3 0%, #f7fbf9 100%)"
                          : "var(--surface-soft)",
                      border:
                        index === 0
                          ? "1px solid #acd2c6"
                          : "1px solid var(--border)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "18px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                        {slot.companyName}
                        {index === 0 && (
                          <span
                            style={{
                              marginLeft: "10px",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "var(--primary-soft)",
                              border: "1px solid #b7d9cf",
                              color: "var(--primary)",
                            }}
                          >
                            Best Fit
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "var(--muted)",
                          fontSize: "0.95rem",
                        }}
                      >
                        {formatTimeLabel(slot.start_time)} – {formatTimeLabel(slot.end_time)}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",
                          fontSize: "0.95rem",
                          color:
                            (slot.matchScore ?? 0) > 0 ? "var(--primary)" : "var(--muted)",
                        }}
                      >
                        Match: {slot.matchScore ?? 0}%
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedCompanyId(slot.companyId)}
                      style={{
                        padding: "12px 18px",
                        borderRadius: "16px",
                        border: "1px solid var(--primary)",
                        background: "var(--primary)",
                        color: "white",
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        cursor: "pointer",
                        boxShadow: "0 8px 18px rgba(37,107,98,0.2)",
                      }}
                      type="button"
                    >
                      Choose personnel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showMore && companyProfile && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(6, 8, 14, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(840px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 18,
              background: "var(--surface)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                  {selectedCompany?.company_name || "Company profile"}
                </h3>
                <div className="p" style={{ marginTop: 6 }}>
                  Detailed overview and fit information
                </div>
              </div>

              <button type="button" className="btn" onClick={() => setShowMore(false)}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-soft)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Description
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.long_description ||
                    companyProfile.short_description ||
                    "No detailed company description available yet."}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Headquarters
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {companyProfile.headquarters || "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Company size
                  </div>
                  <div style={{ fontWeight: 700 }}>{companyProfile.company_size || "N/A"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Hiring types
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {companyProfile.hiring_types?.length
                      ? companyProfile.hiring_types.join(", ")
                      : "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Website
                  </div>
                  {companyProfile.website ? (
                    <a
                      href={companyProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 700 }}
                    >
                      {companyProfile.website}
                    </a>
                  ) : (
                    <div style={{ fontWeight: 700 }}>N/A</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-soft)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Preferred majors
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.majors?.length ? companyProfile.majors.join(", ") : "N/A"}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface-soft)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Skills
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.skills?.length ? companyProfile.skills.join(", ") : "N/A"}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Available Positions</h3>

                {positions.length === 0 ? (
                  <p className="p">No positions listed for this company yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sortedPositions.map((p) => {
                      const match = computePositionMatch(p, studentProfile);

                      return (
                        <div key={p.id} className="card" style={{ padding: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{p.title}</div>
                            <div
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid var(--border)",
                                color: "var(--primary)",
                                background: "var(--primary-soft)",
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {match.score}% Match
                            </div>
                          </div>

                          <div className="p" style={{ fontSize: 13, marginBottom: 6 }}>
                            {p.location_label || "Location not provided"}
                            {p.work_mode ? ` • ${p.work_mode}` : ""}
                            {` • ${p.openings} opening${p.openings === 1 ? "" : "s"}`}
                          </div>

                          <div className="p" style={{ fontSize: 13, marginBottom: 8 }}>
                            Why: {match.reasons.join(" • ")}
                          </div>

                          {p.description && (
                            <div className="p" style={{ marginBottom: 6 }}>
                              {p.description}
                            </div>
                          )}

                          {p.majors?.length ? (
                            <div className="p" style={{ fontSize: 13 }}>
                              <b>Majors:</b> {p.majors.join(", ")}
                            </div>
                          ) : null}

                          {p.skills?.length ? (
                            <div className="p" style={{ fontSize: 13 }}>
                              <b>Skills:</b> {p.skills.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#fbfdfc",
  color: "var(--text)",
};
