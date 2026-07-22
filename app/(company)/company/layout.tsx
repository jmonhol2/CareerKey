"use client";

import Link from "next/link";
import { Suspense } from "react";
import RequirePermission from "@/components/RequirePermission";
import {
  CompanyContextProvider,
  useCompanyContext,
} from "@/contexts/CompanyContext";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="company.portal">
      <Suspense fallback={<p className="p">Loading company portal...</p>}>
        <CompanyContextProvider>
          <CompanyPortalFrame>{children}</CompanyPortalFrame>
        </CompanyContextProvider>
      </Suspense>
    </RequirePermission>
  );
}

function CompanyPortalFrame({ children }: { children: React.ReactNode }) {
  const context = useCompanyContext();
  const companyQuery = context.company ? `?companyId=${context.company.id}` : "";

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "linear-gradient(90deg, #0b1020, #031525)",
      }}
    >
      <aside
        style={{
          width: 260,
          padding: 24,
          borderRight: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.04)",
          color: "white",
        }}
      >
        <h2 style={{ marginBottom: 8, color: "white" }}>Company Portal</h2>
        <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.66)", fontSize: 13 }}>
          {context.role === "admin" ? "Administrator company view" : "Company workspace"}
        </p>

        {context.role === "admin" && context.availableCompanies.length > 0 && (
          <label style={{ display: "grid", gap: 6, marginBottom: 22, fontSize: 12 }}>
            Active company
            <select
              value={context.company?.id ?? ""}
              onChange={(event) => context.selectCompany(event.target.value)}
              style={{ padding: 9, borderRadius: 10, border: 0 }}
            >
              {context.availableCompanies.map((company) => (
                <option value={company.id} key={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Link href={`/company${companyQuery}`} style={navLinkStyle}>Dashboard</Link>
          <Link href={`/company/profile${companyQuery}`} style={navLinkStyle}>Profile</Link>
          <Link href={`/company/positions${companyQuery}`} style={navLinkStyle}>Positions</Link>
          <Link href={`/company/slots${companyQuery}`} style={navLinkStyle}>Time Slots</Link>
          <Link href={`/company/appointments${companyQuery}`} style={navLinkStyle}>
            Appointments
          </Link>
          {context.role === "admin" && (
            <Link href="/admin" style={{ ...navLinkStyle, marginTop: 12 }}>
              Back to Admin
            </Link>
          )}
        </nav>
      </aside>

      <main style={{ flex: 1, padding: 32, color: "white" }}>
        {context.loading ? (
          <p>Loading company access...</p>
        ) : context.error ? (
          <p>Unable to load company access: {context.error}</p>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: "white",
  textDecoration: "none",
};
