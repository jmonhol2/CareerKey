"use client";

import { useCallback, useEffect, useState } from "react";
import PersonnelManager from "@/components/company/PersonnelManager";
import SlotTable, { type Slot } from "@/components/company/SlotTable";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { formatEventDateTime, type RecruitingEvent } from "@/lib/events";
import { supabase } from "@/lib/supabaseClient";

export default function CompanySlotsPage() {
  const { company } = useCompanyContext();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [activeEvent, setActiveEvent] = useState<RecruitingEvent | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSlots = useCallback(async (eventId: string) => {
    if (!company) {
      setSlots([]);
      return;
    }

    const { data, error } = await supabase
      .from("time_slots")
      .select("*")
      .eq("company_id", company.id)
      .eq("event_id", eventId)
      .order("start_time", { ascending: true });

    if (error) {
      setMessage(`Unable to load time slots: ${error.message}`);
      return;
    }

    setSlots(data ?? []);
  }, [company]);

  useEffect(() => {
    let active = true;

    async function loadEventAndSlots() {
      setLoading(true);
      const { data, error } = await supabase
        .from("recruiting_events")
        .select("id, name, start_time, end_time, slot_duration_minutes, timezone, is_active")
        .eq("is_active", true)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setMessage(`Unable to load the event schedule: ${error.message}`);
        setActiveEvent(null);
        setSlots([]);
      } else if (data) {
        const event = data as RecruitingEvent;
        setActiveEvent(event);
        await loadSlots(event.id);
      } else {
        setActiveEvent(null);
        setSlots([]);
      }

      if (active) setLoading(false);
    }

    void loadEventAndSlots();
    return () => {
      active = false;
    };
  }, [loadSlots]);

  return (
    <div>
      <div className="kicker">AVAILABILITY</div>
      <h1>Manage Time Slots</h1>
      <p className="p" style={{ marginBottom: 22 }}>
        Add the personnel students can meet. Each person is automatically available for the
        entire event except during breaks you add below.
      </p>

      {loading ? (
        <p className="p">Loading the active event...</p>
      ) : activeEvent && company ? (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="kicker">{activeEvent.name}</div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 20 }}>Administrator event window</h2>
            <p className="p">
              {formatEventDateTime(activeEvent.start_time, activeEvent.timezone)} – {formatEventDateTime(activeEvent.end_time, activeEvent.timezone)}
            </p>
            <p className="p">
              {activeEvent.slot_duration_minutes}-minute appointments · {activeEvent.timezone}
            </p>
          </div>

          <PersonnelManager
            companyId={company.id}
            event={activeEvent}
            onAvailabilityChange={() => loadSlots(activeEvent.id)}
          />

          <h2 style={{ marginTop: 30 }}>Automatically available slots</h2>
          <p className="p" style={{ marginBottom: 14 }}>
            Capacity reflects the number of personnel available during each time.
          </p>
          <SlotTable slots={slots} />
        </>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <strong>No active event schedule</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Personnel availability will open after an administrator sets the event window.
          </p>
        </div>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}
