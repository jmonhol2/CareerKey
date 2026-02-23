import Link from "next/link";

export default function CompanyPage() {
  return (
    <main>
      <div className="kicker">Company</div>
      <h1 className="h1" style={{ fontSize: 34 }}>Company Portal</h1>
      <p className="p" style={{ maxWidth: 820 }}>
        This is the company/admin flow: define criteria → create time slots → view bookings.
      </p>

      <div className="grid">
        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">Scheduling (Live)</h3>
          <p className="p">
            You can see how students book time slots. Next we’ll add an admin page to create/edit slots.
          </p>
          <div className="btnRow">
            <Link className="btn" href="/schedule">View Slots UI</Link>
          </div>
        </section>

        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">Admin Tools (Next)</h3>
          <p className="p">
            Coming next: create slot blocks, set capacity, and view a list of appointment IDs.
          </p>
          <div className="btnRow">
            <span className="btn" style={{ opacity: 0.6, pointerEvents: "none" }}>Create Slots (soon)</span>
          </div>
        </section>
      </div>
    </main>
  );
}
