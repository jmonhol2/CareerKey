"use client";

import { useEffect, useState } from "react";
import { formatEventDateTime, type RecruitingEvent } from "@/lib/events";
import { supabase } from "@/lib/supabaseClient";

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

function toLocalInputValue(timestamp: string) {
  const date = new Date(timestamp);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export default function EventSettingsForm() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState(15);
  const [timeZone, setTimeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );
  const [activeEvent, setActiveEvent] = useState<RecruitingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      const { data, error } = await supabase
        .from("recruiting_events")
        .select("id, name, start_time, end_time, slot_duration_minutes, timezone, is_active")
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        setMessage(`Unable to load event settings: ${error.message}`);
      } else if (data) {
        const event = data as RecruitingEvent;
        setActiveEvent(event);
        setEventId(event.id);
        setName(event.name);
        setStartTime(toLocalInputValue(event.start_time));
        setEndTime(toLocalInputValue(event.end_time));
        setDuration(event.slot_duration_minutes);
        setTimeZone(event.timezone);
      }

      setLoading(false);
    }

    void loadEvent();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (!name.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setMessage("Enter an event name, start time, and end time.");
      return;
    }

    if (end <= start) {
      setMessage("The event end time must be later than its start time.");
      return;
    }

    const eventLengthMinutes = (end.getTime() - start.getTime()) / 60_000;
    if (eventLengthMinutes < duration) {
      setMessage("The event must be at least one slot long.");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      slot_duration_minutes: duration,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone,
      is_active: true,
    };

    const result = eventId
      ? await supabase
          .from("recruiting_events")
          .update(payload)
          .eq("id", eventId)
          .select("id, name, start_time, end_time, slot_duration_minutes, timezone, is_active")
          .single()
      : await supabase
          .from("recruiting_events")
          .insert(payload)
          .select("id, name, start_time, end_time, slot_duration_minutes, timezone, is_active")
          .single();

    if (result.error) {
      setMessage(`Unable to save event settings: ${result.error.message}`);
    } else {
      const savedEvent = result.data as RecruitingEvent;
      setActiveEvent(savedEvent);
      setEventId(savedEvent.id);
      setTimeZone(savedEvent.timezone);
      setMessage("Event schedule saved. Company time slots are now governed by this window.");
    }

    setSaving(false);
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="kicker">ACTIVE EVENT</div>
      <h2 style={{ margin: "8px 0 6px" }}>Event schedule</h2>
      <p className="p" style={{ marginBottom: 18 }}>
        Set the only times companies may offer appointments. Slot length applies to every
        company participating in the event.
      </p>

      {loading ? (
        <p className="p">Loading event schedule...</p>
      ) : (
        <form onSubmit={handleSubmit} className="formPanel" style={{ maxWidth: "none" }}>
          <div className="formField" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="event-name">Event name</label>
            <input
              id="event-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fall Engineering Expo"
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="event-start">Event starts</label>
            <input
              id="event-start"
              type="datetime-local"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="event-end">Event ends</label>
            <input
              id="event-end"
              type="datetime-local"
              value={endTime}
              min={startTime || undefined}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </div>

          <div className="formField">
            <label htmlFor="slot-duration">Appointment length</label>
            <select
              id="slot-duration"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option value={minutes} key={minutes}>{minutes} minutes</option>
              ))}
            </select>
          </div>

          <div className="formField">
            <label>Event time zone</label>
            <div className="eventReadOnlyField">{timeZone}</div>
          </div>

          <button type="submit" className="btn btnPrimary" disabled={saving}>
            {saving ? "Saving..." : activeEvent ? "Update event schedule" : "Set event schedule"}
          </button>
        </form>
      )}

      {activeEvent && (
        <p className="p" style={{ marginTop: 14 }}>
          Current window: {formatEventDateTime(activeEvent.start_time, activeEvent.timezone)} – {formatEventDateTime(activeEvent.end_time, activeEvent.timezone)}
        </p>
      )}
      {message && <p style={{ margin: "14px 0 0" }}>{message}</p>}
    </section>
  );
}
