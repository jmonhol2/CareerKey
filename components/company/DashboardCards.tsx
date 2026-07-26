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
    <div className="statGrid">
      <div className="statCard">
        <h3>Total Slots</h3>
        <p>{totalSlots}</p>
      </div>

      <div className="statCard">
        <h3>Booked Appointments</h3>
        <p>{bookedAppointments}</p>
      </div>

      <div className="statCard">
        <h3>Open Seats</h3>
        <p>{openSeats}</p>
      </div>
    </div>
  );
}
