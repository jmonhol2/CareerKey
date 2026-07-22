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
    <div className="portalLayout">
      <aside className="portalSidebar">
        <div className="portalBrand">
          <span className="appBrandMark" aria-hidden="true">
            <span className="appKeyRing" />
            <span className="appKeyStem" />
          </span>
          <div>
            <h2>CareerKey</h2>
            <p>{context.role === "admin" ? "Administrator company view" : "Company workspace"}</p>
          </div>
        </div>

        {context.role === "admin" && context.availableCompanies.length > 0 && (
          <label className="portalCompanyPicker">
            Active company
            <select
              value={context.company?.id ?? ""}
              onChange={(event) => context.selectCompany(event.target.value)}
            >
              {context.availableCompanies.map((company) => (
                <option value={company.id} key={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="portalNav">
          <Link href={`/company${companyQuery}`} className="portalNavLink">Dashboard</Link>
          <Link href={`/company/profile${companyQuery}`} className="portalNavLink">Profile</Link>
          <Link href={`/company/positions${companyQuery}`} className="portalNavLink">Positions</Link>
          <Link href={`/company/slots${companyQuery}`} className="portalNavLink">Time Slots</Link>
          <Link href={`/company/appointments${companyQuery}`} className="portalNavLink">
            Appointments
          </Link>
          {context.role === "admin" && (
            <Link href="/admin" className="portalNavLink">
              Back to Admin
            </Link>
          )}
        </nav>
      </aside>

      <main className="portalContent">
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
