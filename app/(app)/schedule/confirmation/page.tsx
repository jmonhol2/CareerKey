"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppNav from "@/components/AppNav";
import RequirePermission from "@/components/RequirePermission";
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

type PersonnelRow = {
  name: string;
  role_title: string;
};

function formatInTZ(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString([], {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  });
}

function toIcsUtc(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export default function ConfirmationPage() {
  return (
    <RequirePermission permission="student.portal">
      <Suspense fallback={<main className="container">Loading confirmation...</main>}>
        <ConfirmationPageContent />
      </Suspense>
    </RequirePermission>
  );
}

function ConfirmationPageContent() {
  const params = useSearchParams();
  const appointmentId = params.get("appointmentId");
  const slotId = params.get("slotId");
  const timeZone =
    params.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [personnel, setPersonnel] = useState<PersonnelRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfirmation() {
      try {
        setError(null);
        if (!slotId) return;

        const { data: slotData, error: slotError } = await supabase
          .from("time_slots")
          .select("id, start_time, end_time, company_id")
          .eq("id", slotId)
          .single();

        if (slotError) throw slotError;
        const slotRow = slotData as SlotRow;
        setSlot(slotRow);

        const { data: companyData, error: companyError } = await supabase
          .from("companies")
          .select("id, company_name")
          .eq("id", slotRow.company_id)
          .single();

        if (companyError) throw companyError;
        setCompany(companyData as CompanyRow);

        if (appointmentId) {
          const { data: appointmentData, error: appointmentError } = await supabase
            .from("appointments")
            .select("personnel:company_personnel(name, role_title)")
            .eq("id", appointmentId)
            .single();

          if (appointmentError) throw appointmentError;
          const joinedPersonnel = Array.isArray(appointmentData.personnel)
            ? appointmentData.personnel[0]
            : appointmentData.personnel;
          setPersonnel((joinedPersonnel as PersonnelRow | null) ?? null);
        }
      } catch (loadError: unknown) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load confirmation details"
        );
      }
    }

    void loadConfirmation();
  }, [appointmentId, slotId]);

  const icsHref = useMemo(() => {
    if (!appointmentId || !slot || !company) return null;

    const title = `Engineering Expo: ${company.company_name}`;
    const description = `Appointment booked with ${personnel?.name ?? company.company_name}.\nAppointment ID: ${appointmentId}\nTime zone shown: ${timeZone}`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CareerKey//Expo Scheduler//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${appointmentId}@careerkey`,
      `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
      `DTSTART:${toIcsUtc(slot.start_time)}`,
      `DTEND:${toIcsUtc(slot.end_time)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  }, [appointmentId, company, personnel, slot, timeZone]);

  return (
    <main className="container">
      <section className="shell">
        <AppNav />
        <div className="main">
          <div className="kicker">BOOKING COMPLETE</div>
          <h1 className="h1" style={{ fontSize: 36 }}>Appointment confirmed</h1>
          <p className="p">Your meeting is booked. Save the details or add them to your calendar.</p>

          {error && <div className="card" style={{ marginTop: 18 }}><b>Error:</b> {error}</div>}

          {!appointmentId ? (
            <div className="card" style={{ marginTop: 18 }}>Missing appointment ID. Try booking again.</div>
          ) : (
            <div className="card" style={{ marginTop: 22, maxWidth: 720 }}>
              <div className="statusPill">Confirmed</div>
              <div className="p" style={{ marginTop: 18, fontSize: 12 }}>Appointment ID</div>
              <div style={{ fontSize: 18, fontWeight: 850 }}>{appointmentId}</div>

              <div className="p" style={{ marginTop: 16, fontSize: 12 }}>Company</div>
              <div style={{ fontSize: 20, fontWeight: 850 }}>
                {company?.company_name ?? "Loading..."}
              </div>

              <div className="p" style={{ marginTop: 16, fontSize: 12 }}>Meeting with</div>
              <div style={{ fontSize: 18, fontWeight: 850 }}>
                {personnel?.name ?? "Loading personnel..."}
              </div>
              {personnel?.role_title && <div className="p">{personnel.role_title}</div>}

              <div className="p" style={{ marginTop: 16, fontSize: 12 }}>Time ({timeZone})</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {slot
                  ? `${formatInTZ(slot.start_time, timeZone)} → ${formatInTZ(slot.end_time, timeZone)}`
                  : "Loading..."}
              </div>

              <div className="btnRow">
                <a href="/schedule" className="btn">Back to Schedule</a>
                {icsHref && (
                  <a
                    href={icsHref}
                    download={`careerkey-appointment-${appointmentId}.ics`}
                    className="btn btnPrimary"
                  >
                    Add to Calendar (.ics)
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
