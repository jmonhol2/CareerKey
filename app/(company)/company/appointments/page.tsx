"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AppointmentTable from "@/components/company/AppointmentTable";

type AppointmentRow = {
  id: string;
  status: string;
  created_at: string;
  slot_id: string;
  student_id: string;
};

type SlotMap = Record<string, { start_time: string; end_time: string }>;
type ProfileMap = Record<string, { display_name: string | null }>;

export default function CompanyAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [slotMap, setSlotMap] = useState<SlotMap>({});
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppointments() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

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

      setLoading(false);
    }

    loadAppointments();
  }, []);

  if (loading) return <p>Loading appointments...</p>;

  return (
    <div>
      <h1>Appointments</h1>
      <AppointmentTable
        appointments={appointments}
        slotMap={slotMap}
        profileMap={profileMap}
      />
    </div>
  );
}
