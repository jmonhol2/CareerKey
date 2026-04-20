export type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
};

type SlotTableProps = {
  slots: Slot[];
  onDeleteSlot: (slotId: string) => void;
};

export default function SlotTable({ slots, onDeleteSlot }: SlotTableProps) {
  if (slots.length === 0) {
    return <p>No time slots created yet.</p>;
  }

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Start</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>End</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Capacity</th>
          <th style={{ border: "1px solid #ddd", padding: "8px" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => (
          <tr key={slot.id}>
            <td style={{ border: "1px solid #ddd", padding: "8px" }}>
              {new Date(slot.start_time).toLocaleString()}
            </td>
            <td style={{ border: "1px solid #ddd", padding: "8px" }}>
              {new Date(slot.end_time).toLocaleString()}
            </td>
            <td style={{ border: "1px solid #ddd", padding: "8px" }}>{slot.capacity}</td>
            <td style={{ border: "1px solid #ddd", padding: "8px" }}>
              <button onClick={() => onDeleteSlot(slot.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
