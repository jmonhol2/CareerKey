import Link from "next/link";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "linear-gradient(90deg, #0b1020, #031525)" }}>
      <aside
        style={{
          width: "260px",
          padding: "24px",
          borderRight: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "white",
        }}
      >
        <h2 style={{ marginBottom: "24px", color: "white" }}>Company Portal</h2>

        <nav style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Link href="/company" style={{ color: "white", textDecoration: "none" }}>
            Dashboard
          </Link>
          <Link href="/company/profile" style={{ color: "white", textDecoration: "none" }}>
            Profile
          </Link>
          <Link href="/company/slots" style={{ color: "white", textDecoration: "none" }}>
            Time Slots
          </Link>
          <Link href="/company/appointments" style={{ color: "white", textDecoration: "none" }}>
            Appointments
          </Link>
        </nav>
      </aside>

      <main style={{ flex: 1, padding: "32px", color: "white" }}>
        {children}
      </main>
    </div>
  );
}
