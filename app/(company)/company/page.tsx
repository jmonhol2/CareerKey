"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import DashboardCards from "@/components/company/DashboardCards";

type DashboardStats = {
  totalSlots: number;
  bookedAppointments: number;
  openSeats: number;
};

export default function CompanyDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSlots: 0,
    bookedAppointments: 0,
    openSeats: 0,
  });

  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    async function loadDashboard() {
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
        .select("id, company_name")
        .eq("owner_user_id", user.id)
        .single();

      if (!company) {
        setLoading(false);
        return;
      }

      setCompanyName(company.company_name);

      const { data: slots } = await supabase
        .from("time_slots")
        .select("id, capacity")
        .eq("company_id", company.id);

      const slotIds = slots?.map((slot) => slot.id) ?? [];
      const totalCapacity = slots?.reduce((sum, slot) => sum + slot.capacity, 0) ?? 0;

      let bookedAppointments = 0;

      if (slotIds.length > 0) {
        const { count } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .in("slot_id", slotIds);

        bookedAppointments = count ?? 0;
      }

      setStats({
        totalSlots: slots?.length ?? 0,
        bookedAppointments,
        openSeats: totalCapacity - bookedAppointments,
      });

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div>
      <h1>Company Dashboard</h1>
      <p>Welcome{companyName ? `, ${companyName}` : ""}.</p>
      <DashboardCards
        totalSlots={stats.totalSlots}
        bookedAppointments={stats.bookedAppointments}
        openSeats={stats.openSeats}
      />
    </div>
  );
}
