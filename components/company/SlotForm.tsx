type SlotFormProps = {
  startTime: string;
  endTime: string;
  capacity: number;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onCapacityChange: (value: number) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function SlotForm({
  startTime,
  endTime,
  capacity,
  onStartTimeChange,
  onEndTimeChange,
  onCapacityChange,
  onSubmit,
}: SlotFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: "12px", maxWidth: "500px", marginBottom: "32px" }}
    >
      <div>
        <label>Start Time</label>
        <br />
        <input type="datetime-local" value={startTime} onChange={(e) => onStartTimeChange(e.target.value)} />
      </div>

      <div>
        <label>End Time</label>
        <br />
        <input type="datetime-local" value={endTime} onChange={(e) => onEndTimeChange(e.target.value)} />
      </div>

      <div>
        <label>Capacity</label>
        <br />
        <input
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => onCapacityChange(Number(e.target.value))}
        />
      </div>

      <button type="submit">Create Slot</button>
    </form>
  );
}
