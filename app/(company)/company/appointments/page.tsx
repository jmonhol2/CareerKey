"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppointmentTable from "@/components/company/AppointmentTable";
import { useCompanyContext } from "@/contexts/CompanyContext";

type AppointmentRow = {
  id: string;
  status: string;
  created_at: string;
  slot_id: string;
  student_id: string;
  personnel_id: string | null;
};

type SlotMap = Record<string, { start_time: string; end_time: string }>;
type ProfileMap = Record<string, { display_name: string | null }>;
type PersonnelMap = Record<string, { name: string; role_title: string }>;

export default function CompanyAppointmentsPage() {
  const { company } = useCompanyContext();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [slotMap, setSlotMap] = useState<SlotMap>({});
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [personnelMap, setPersonnelMap] = useState<PersonnelMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppointments() {
      setLoading(true);

      if (!company) {
        setLoading(false);
        return;
      }

      const { data: slots } = await supabase
        .from("time_slots")
        .select("id, start_time, end_time")
        .eq("company_id", company.id);

      const slotIds = slots?.map((s) => s.id) ?? [];

      const slotDictionary: SlotMap = {};
      (slots ?? []).forEach((slot) => {
        slotDictionary[slot.id] = {
          start_time: slot.start_time,
          end_time: slot.end_time,
        };
      });

      setSlotMap(slotDictionary);

      if (slotIds.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const { data: appts } = await supabase
        .from("appointments")
        .select("*")
        .in("slot_id", slotIds)
        .order("created_at", { ascending: false });

      setAppointments(appts ?? []);

      const studentIds = [...new Set((appts ?? []).map((a) => a.student_id))];
      const personnelIds = [
        ...new Set((appts ?? []).map((appointment) => appointment.personnel_id).filter(Boolean)),
      ] as string[];

      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", studentIds);

        const profileDictionary: ProfileMap = {};
        (profiles ?? []).forEach((profile) => {
          profileDictionary[profile.user_id] = {
            display_name: profile.display_name,
          };
        });

        setProfileMap(profileDictionary);
      }

      if (personnelIds.length > 0) {
        const { data: personnelRows } = await supabase
          .from("company_personnel")
          .select("id, name, role_title")
          .in("id", personnelIds);

        const personnelDictionary: PersonnelMap = {};
        (personnelRows ?? []).forEach((personnel) => {
          personnelDictionary[personnel.id] = {
            name: personnel.name,
            role_title: personnel.role_title,
          };
        });
        setPersonnelMap(personnelDictionary);
      }

      setLoading(false);
    }

    void loadAppointments();
  }, [company]);

  if (loading) return <p>Loading appointments...</p>;

  return (
    <div>
      <div className="kicker">RECRUITING SCHEDULE</div>
      <h1>Appointments</h1>
      <p className="p" style={{ marginBottom: 22 }}>Review the students scheduled to meet with your team.</p>
      <AppointmentTable
        appointments={appointments}
        slotMap={slotMap}
        profileMap={profileMap}
        personnelMap={personnelMap}
      />
    </div>
  );
}
