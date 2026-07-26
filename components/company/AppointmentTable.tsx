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

type AppointmentTableProps = {
  appointments: AppointmentRow[];
  slotMap: SlotMap;
  profileMap: ProfileMap;
  personnelMap: PersonnelMap;
};

export default function AppointmentTable({
  appointments,
  slotMap,
  profileMap,
  personnelMap,
}: AppointmentTableProps) {
  if (appointments.length === 0) {
    return <p>No student appointments yet.</p>;
  }

  return (
    <div className="tableWrap"><table>
      <thead>
        <tr>
          <th>Student</th><th>Personnel</th><th>Slot Start</th><th>Slot End</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appt) => {
          const slot = slotMap[appt.slot_id];
          const profile = profileMap[appt.student_id];
          const personnel = appt.personnel_id ? personnelMap[appt.personnel_id] : null;

          return (
            <tr key={appt.id}>
              <td>
                {profile?.display_name || appt.student_id}
              </td>
              <td>
                {personnel ? `${personnel.name} — ${personnel.role_title}` : "Not assigned"}
              </td>
              <td>
                {slot ? new Date(slot.start_time).toLocaleString() : "Unknown"}
              </td>
              <td>
                {slot ? new Date(slot.end_time).toLocaleString() : "Unknown"}
              </td>
              <td><span className="statusPill">{appt.status}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}
