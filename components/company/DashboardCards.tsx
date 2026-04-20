type DashboardCardsProps = {
  totalSlots: number;
  bookedAppointments: number;
  openSeats: number;
};

export default function DashboardCards({
  totalSlots,
  bookedAppointments,
  openSeats,
}: DashboardCardsProps) {
  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "24px", flexWrap: "wrap" }}>
      <div style={{ border: "1px solid #ddd", padding: "20px", minWidth: "180px" }}>
        <h3>Total Slots</h3>
        <p>{totalSlots}</p>
      </div>

      <div style={{ border: "1px solid #ddd", padding: "20px", minWidth: "180px" }}>
        <h3>Booked Appointments</h3>
        <p>{bookedAppointments}</p>
      </div>

      <div style={{ border: "1px solid #ddd", padding: "20px", minWidth: "180px" }}>
        <h3>Open Seats</h3>
        <p>{openSeats}</p>
      </div>
    </div>
  );
}
