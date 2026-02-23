import HomeActions from "./HomeActions";
import AppNav from "../AppNav"; // if you add it


export default async function HomePage() {
  // TODO: replace with your real role fetch
  const role = "student";

  return (
    <div className="container" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="shell" style={{ width: "min(900px, 100%)" }}>
        <div className="main">
          <div className="kicker">HOME</div>
          <h1 className="h1">Welcome</h1>
          <p className="p">
            Role: <span style={{ color: "var(--text)", fontWeight: 800 }}>{role}</span>. This is your post-login hub.
          </p>

          <div className="card" style={{ marginTop: 16 }}>
            <HomeActions />
            <p className="p" style={{ marginTop: 12 }}>
              Tip: Your dashboard will adapt based on role (student vs company).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
