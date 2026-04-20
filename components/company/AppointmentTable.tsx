type AppointmentRow = {
  id: string;
  status: string;
  created_at: string;
  slot_id: string;
  student_id: string;
};

type SlotMap = Record<string, { start_time: string; end_time: string }>;
type ProfileMap = Record<string, { display_name: string | null }>;

type AppointmentTableProps = {
  appointments: AppointmentRow[];
  slotMap: SlotMap;
  profileMap: ProfileMap;
};

export default function AppointmentTable({
  appointments,
  slotMap,
  profileMap,
}: AppointmentTableProps) {
  if (appointments.length === 0) {
    return <p>No student appointments yet.</p>;
  }

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Student</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Slot Start</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Slot End</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appt) => {
          const slot = slotMap[appt.slot_id];
          const profile = profileMap[appt.student_id];

          return (
            <tr key={appt.id}>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {profile?.display_name || appt.student_id}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {slot ? new Date(slot.start_time).toLocaleString() : "Unknown"}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {slot ? new Date(slot.end_time).toLocaleString() : "Unknown"}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>{appt.status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
