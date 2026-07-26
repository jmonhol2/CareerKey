"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatEventDateTime,
  getEventSlotOptions,
  type RecruitingEvent,
} from "@/lib/events";
import { supabase } from "@/lib/supabaseClient";

type Personnel = {
  id: string;
  company_id: string;
  name: string;
  role_title: string;
  bio: string | null;
};

type PersonnelBreak = {
  id: string;
  personnel_id: string;
  start_time: string;
  end_time: string;
  note: string | null;
};

type PersonnelManagerProps = {
  companyId: string;
  event: RecruitingEvent;
  onAvailabilityChange: () => Promise<void>;
};

export default function PersonnelManager({
  companyId,
  event,
  onAvailabilityChange,
}: PersonnelManagerProps) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [breaks, setBreaks] = useState<PersonnelBreak[]>([]);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [bio, setBio] = useState("");
  const [breakPersonnelId, setBreakPersonnelId] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [breakNote, setBreakNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const slotOptions = useMemo(() => getEventSlotOptions(event), [event]);

  const loadPersonnel = useCallback(async () => {
    const [personnelResult, assignmentResult, breakResult] = await Promise.all([
      supabase
        .from("company_personnel")
        .select("id, company_id, name, role_title, bio")
        .eq("company_id", companyId)
        .order("name"),
      supabase
        .from("company_event_personnel")
        .select("personnel_id")
        .eq("company_id", companyId)
        .eq("event_id", event.id),
      supabase
        .from("personnel_breaks")
        .select("id, personnel_id, start_time, end_time, note")
        .eq("company_id", companyId)
        .eq("event_id", event.id)
        .order("start_time"),
    ]);

    const firstError = personnelResult.error || assignmentResult.error || breakResult.error;
    if (firstError) {
      setMessage(`Unable to load personnel: ${firstError.message}`);
      return;
    }

    const nextPersonnel = (personnelResult.data ?? []) as Personnel[];
    const nextAssignedIds = new Set(
      (assignmentResult.data ?? []).map((assignment) => assignment.personnel_id)
    );
    setPersonnel(nextPersonnel);
    setAssignedIds(nextAssignedIds);
    setBreaks((breakResult.data ?? []) as PersonnelBreak[]);

    const firstAssigned = nextPersonnel.find((person) => nextAssignedIds.has(person.id));
    setBreakPersonnelId((current) =>
      current && nextAssignedIds.has(current) ? current : firstAssigned?.id ?? ""
    );
  }, [companyId, event.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPersonnel();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadPersonnel]);

  async function handleCreatePersonnel(eventForm: React.FormEvent) {
    eventForm.preventDefault();
    setMessage(null);
    setSaving(true);

    const { data, error } = await supabase
      .from("company_personnel")
      .insert({
        company_id: companyId,
        name: name.trim(),
        role_title: roleTitle.trim(),
        bio: bio.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(`Unable to create personnel profile: ${error.message}`);
      setSaving(false);
      return;
    }

    const { error: assignmentError } = await supabase
      .from("company_event_personnel")
      .insert({ company_id: companyId, event_id: event.id, personnel_id: data.id });

    if (assignmentError) {
      await supabase.from("company_personnel").delete().eq("id", data.id);
      setMessage(`Unable to add personnel to this event: ${assignmentError.message}`);
    } else {
      setName("");
      setRoleTitle("");
      setBio("");
      setMessage("Personnel profile created and made available for the full event.");
      await Promise.all([loadPersonnel(), onAvailabilityChange()]);
    }

    setSaving(false);
  }

  async function toggleEventAssignment(personnelId: string, assigned: boolean) {
    setMessage(null);
    const result = assigned
      ? await supabase
          .from("company_event_personnel")
          .delete()
          .eq("event_id", event.id)
          .eq("personnel_id", personnelId)
      : await supabase.from("company_event_personnel").insert({
          company_id: companyId,
          event_id: event.id,
          personnel_id: personnelId,
        });

    if (result.error) {
      setMessage(`Unable to update event personnel: ${result.error.message}`);
      return;
    }

    setMessage(assigned ? "Personnel removed from this event." : "Personnel added to this event.");
    await Promise.all([loadPersonnel(), onAvailabilityChange()]);
  }

  async function handleDeletePersonnel(personnelId: string) {
    setMessage(null);
    const { error } = await supabase.from("company_personnel").delete().eq("id", personnelId);
    if (error) {
      setMessage(`Unable to delete personnel profile: ${error.message}`);
      return;
    }

    setMessage("Personnel profile deleted.");
    await Promise.all([loadPersonnel(), onAvailabilityChange()]);
  }

  async function handleCreateBreak(eventForm: React.FormEvent) {
    eventForm.preventDefault();
    setMessage(null);

    if (!breakPersonnelId || !breakStart || !breakEnd) {
      setMessage("Choose personnel, a break start, and a break end.");
      return;
    }

    if (new Date(breakEnd) <= new Date(breakStart)) {
      setMessage("Break end must be later than break start.");
      return;
    }

    const { error } = await supabase.from("personnel_breaks").insert({
      company_id: companyId,
      event_id: event.id,
      personnel_id: breakPersonnelId,
      start_time: breakStart,
      end_time: breakEnd,
      note: breakNote.trim() || null,
    });

    if (error) {
      setMessage(`Unable to add break: ${error.message}`);
      return;
    }

    setBreakStart("");
    setBreakEnd("");
    setBreakNote("");
    setMessage("Break added. This person is no longer bookable during that period.");
    await Promise.all([loadPersonnel(), onAvailabilityChange()]);
  }

  async function handleDeleteBreak(breakId: string) {
    const { error } = await supabase.from("personnel_breaks").delete().eq("id", breakId);
    if (error) {
      setMessage(`Unable to remove break: ${error.message}`);
      return;
    }

    setMessage("Break removed. The personnel member is available again.");
    await Promise.all([loadPersonnel(), onAvailabilityChange()]);
  }

  const assignedPersonnel = personnel.filter((person) => assignedIds.has(person.id));
  const endOptions = slotOptions.map((option) => ({
    value: option.endTime,
    label: formatEventDateTime(option.endTime, event.timezone),
  }));

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section className="card">
        <div className="kicker">COMPANY PERSONNEL</div>
        <h2 style={{ margin: "8px 0 6px" }}>Who students can meet</h2>
        <p className="p" style={{ marginBottom: 18 }}>
          New personnel are automatically available for every appointment time in this event.
        </p>

        <form onSubmit={handleCreatePersonnel} className="formPanel" style={{ maxWidth: "none" }}>
          <div className="formField">
            <label htmlFor="personnel-name">Name</label>
            <input id="personnel-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="formField">
            <label htmlFor="personnel-role">Role</label>
            <input id="personnel-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Senior Manufacturing Engineer" required />
          </div>
          <div className="formField" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="personnel-bio">Brief description</label>
            <textarea id="personnel-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Share what this person does and what students can ask them about." />
          </div>
          <button className="btn btnPrimary" type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add personnel"}
          </button>
        </form>

        <div className="personnelGrid">
          {personnel.map((person) => {
            const assigned = assignedIds.has(person.id);
            return (
              <article className="personnelCard" key={person.id}>
                <div className="statusPill">{assigned ? "Attending event" : "Not attending"}</div>
                <h3>{person.name}</h3>
                <strong>{person.role_title}</strong>
                <p>{person.bio || "No description provided."}</p>
                <div className="btnRow">
                  <button className="btn" type="button" onClick={() => toggleEventAssignment(person.id, assigned)}>
                    {assigned ? "Remove from event" : "Add to event"}
                  </button>
                  <button className="btn" type="button" onClick={() => handleDeletePersonnel(person.id)}>
                    Delete profile
                  </button>
                </div>
              </article>
            );
          })}
          {personnel.length === 0 && <p className="p">No personnel profiles yet.</p>}
        </div>
      </section>

      <section className="card">
        <div className="kicker">BREAKS</div>
        <h2 style={{ margin: "8px 0 6px" }}>Block unavailable time</h2>
        <p className="p" style={{ marginBottom: 18 }}>
          Personnel remain open for the entire event except for the breaks listed here.
        </p>

        {assignedPersonnel.length ? (
          <form onSubmit={handleCreateBreak} className="formPanel" style={{ maxWidth: "none" }}>
            <div className="formField">
              <label htmlFor="break-personnel">Personnel</label>
              <select id="break-personnel" value={breakPersonnelId} onChange={(e) => setBreakPersonnelId(e.target.value)} required>
                {assignedPersonnel.map((person) => <option value={person.id} key={person.id}>{person.name} — {person.role_title}</option>)}
              </select>
            </div>
            <div className="formField">
              <label htmlFor="break-start">Break starts</label>
              <select id="break-start" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} required>
                <option value="">Choose start</option>
                {slotOptions.map((option) => <option value={option.startTime} key={option.startTime}>{formatEventDateTime(option.startTime, event.timezone)}</option>)}
              </select>
            </div>
            <div className="formField">
              <label htmlFor="break-end">Break ends</label>
              <select id="break-end" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} required>
                <option value="">Choose end</option>
                {endOptions.filter((option) => !breakStart || new Date(option.value) > new Date(breakStart)).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="formField">
              <label htmlFor="break-note">Note (optional)</label>
              <input id="break-note" value={breakNote} onChange={(e) => setBreakNote(e.target.value)} placeholder="Lunch" />
            </div>
            <button className="btn btnPrimary" type="submit">Add break</button>
          </form>
        ) : (
          <p className="p">Add at least one personnel member to this event before scheduling breaks.</p>
        )}

        <div className="personnelBreakList">
          {breaks.map((personnelBreak) => {
            const person = personnel.find((item) => item.id === personnelBreak.personnel_id);
            return (
              <div className="personnelBreak" key={personnelBreak.id}>
                <div>
                  <strong>{person?.name ?? "Personnel"}</strong>
                  <p className="p">{formatEventDateTime(personnelBreak.start_time, event.timezone)} – {formatEventDateTime(personnelBreak.end_time, event.timezone)}{personnelBreak.note ? ` · ${personnelBreak.note}` : ""}</p>
                </div>
                <button className="btn" type="button" onClick={() => handleDeleteBreak(personnelBreak.id)}>Remove break</button>
              </div>
            );
          })}
          {breaks.length === 0 && <p className="p">No breaks have been added.</p>}
        </div>
      </section>

      {message && <p>{message}</p>}
    </div>
  );
}
