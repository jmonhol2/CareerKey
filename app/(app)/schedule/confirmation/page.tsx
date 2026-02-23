"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SlotRow = {
  id: string;
  start_time: string;
  end_time: string;
  company_id: string;
};

type CompanyRow = {
  id: string;
  company_name: string;
};

function formatInTZ(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString([], {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  });
}

function toIcsUtc(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export default function ConfirmationPage() {
  const params = useSearchParams();
  const appointmentId = params.get("appointmentId");
  const slotId = params.get("slotId");
  const tz =
    params.get("tz") ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load slot + company (2-query version, reliable)
  useEffect(() => {
    (async () => {
      try {
        setError(null);
        if (!slotId) return;

        const { data: slotData, error: slotErr } = await supabase
          .from("time_slots")
          .select("id, start_time, end_time, company_id")
          .eq("id", slotId)
          .single();

        if (slotErr) throw slotErr;
        setSlot(slotData as SlotRow);

        const { data: companyData, error: compErr } = await supabase
          .from("companies")
          .select("id, company_name")
          .eq("id", (slotData as any).company_id)
          .single();

        if (compErr) throw compErr;
        setCompany(companyData as CompanyRow);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load confirmation details");
      }
    })();
  }, [slotId]);

  // Build an ICS file link
  const icsHref = useMemo(() => {
    if (!appointmentId || !slot || !company) return null;

    const dtStart = toIcsUtc(slot.start_time);
    const dtEnd = toIcsUtc(slot.end_time);
    const now = toIcsUtc(new Date().toISOString());

    const title = `Engineering Expo: ${company.company_name}`;
    const description = `Appointment booked.\nAppointment ID: ${appointmentId}\nTime zone shown: ${tz}`;
    const uid = `${appointmentId}@careerkey`;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CareerKey//Expo Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [appointmentId, slot, company, tz]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 6 }}>
        Appointment Confirmed ✅
      </h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Your meeting is booked. Save this page or add it to your calendar.
      </p>

      {error && (
        <div style={{ padding: 12, border: "1px solid #ccc", marginTop: 12 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {!appointmentId ? (
        <p style={{ opacity: 0.8 }}>Missing appointment ID. Try booking again.</p>
      ) : (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            maxWidth: 720,
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.75 }}>Appointment ID</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{appointmentId}</div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
            Company
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {company?.company_name ?? "Loading…"}
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
            Time ({tz})
          </div>
          <div style={{ fontSize: 16 }}>
            {slot
              ? `${formatInTZ(slot.start_time, tz)} → ${formatInTZ(slot.end_time, tz)}`
              : "Loading…"}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <a
              href="/schedule"
              style={{
                padding: "10px 14px",
                border: "1px solid #ddd",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              Back to Schedule
            </a>

            {icsHref && (
              <a
                href={icsHref}
                download={`careerkey-appointment-${appointmentId}.ics`}
                style={{
                  padding: "10px 14px",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Add to Calendar (.ics)
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
