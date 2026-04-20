import Link from "next/link";

export default function CompanyNav() {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        marginTop: "20px",
      }}
    >
      <Link href="/company">Dashboard</Link>
      <Link href="/company/profile">Profile</Link>
      <Link href="/company/slots">Time Slots</Link>
      <Link href="/company/appointments">Appointments</Link>
    </nav>
  );
}
