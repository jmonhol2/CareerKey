export type Slot = {
  id: string;
  event_id: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
};

type SlotTableProps = {
  slots: Slot[];
  onDeleteSlot?: (slotId: string) => void;
};

export default function SlotTable({ slots, onDeleteSlot }: SlotTableProps) {
  if (slots.length === 0) {
    return <p>No time slots created yet.</p>;
  }

  return (
    <div className="tableWrap"><table>
      <thead>
        <tr>
          <th>Start</th><th>End</th><th>Personnel capacity</th>
          {onDeleteSlot && <th>Action</th>}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => (
          <tr key={slot.id}>
            <td>
              {new Date(slot.start_time).toLocaleString()}
            </td>
            <td>
              {new Date(slot.end_time).toLocaleString()}
            </td>
            <td>{slot.capacity}</td>
            {onDeleteSlot && (
              <td>
                <button className="btn" onClick={() => onDeleteSlot(slot.id)}>Delete</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
