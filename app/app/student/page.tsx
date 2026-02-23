import Link from "next/link";

export default function StudentPage() {
  return (
    <main>
      <div className="kicker">Student</div>
      <h1 className="h1" style={{ fontSize: 34 }}>Student Portal</h1>
      <p className="p" style={{ maxWidth: 820 }}>
        This is the student flow: upload resume → see matches → book a time slot → confirm + add to calendar.
      </p>

      <div className="grid">
        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">Scheduling (Live)</h3>
          <p className="p">Book an appointment with a company and receive a confirmation page.</p>
          <div className="btnRow">
            <Link className="btn btnPrimary" href="/schedule">Book a Slot</Link>
          </div>
        </section>

        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">Resume Upload (Next)</h3>
          <p className="p">
            Coming next: upload a resume, parse keywords/skills, and compute a match score list.
          </p>
          <div className="btnRow">
            <span className="btn" style={{ opacity: 0.6, pointerEvents: "none" }}>Upload Resume (soon)</span>
          </div>
        </section>
      </div>
    </main>
  );
}
