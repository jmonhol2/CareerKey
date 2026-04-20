"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SlotForm from "@/components/company/SlotForm";
import SlotTable, { type Slot } from "@/components/company/SlotTable";

export default function CompanySlotsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [message, setMessage] = useState("");

  async function loadSlots() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!company) return;

    setCompanyId(company.id);

    const { data: slotData } = await supabase
      .from("time_slots")
      .select("*")
      .eq("company_id", company.id)
      .order("start_time", { ascending: true });

    setSlots(slotData ?? []);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSlots();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!companyId) {
      setMessage("No company profile found.");
      return;
    }

    const { error } = await supabase.from("time_slots").insert({
      company_id: companyId,
      start_time: startTime,
      end_time: endTime,
      capacity,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Slot created successfully.");
    setStartTime("");
    setEndTime("");
    setCapacity(1);
    loadSlots();
  }

  async function handleDeleteSlot(slotId: string) {
    const { error } = await supabase.from("time_slots").delete().eq("id", slotId);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Slot deleted.");
    loadSlots();
  }

  return (
    <div>
      <h1>Manage Time Slots</h1>
      <SlotForm
        startTime={startTime}
        endTime={endTime}
        capacity={capacity}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
        onCapacityChange={setCapacity}
        onSubmit={handleCreateSlot}
      />

      {message && <p>{message}</p>}

      <h2>Existing Slots</h2>
      <SlotTable slots={slots} onDeleteSlot={handleDeleteSlot} />
    </div>
  );
}
