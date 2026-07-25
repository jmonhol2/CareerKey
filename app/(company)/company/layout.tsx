"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import RequirePermission from "@/components/RequirePermission";
import NavIcon from "@/components/NavIcon";
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
  const pathname = usePathname();
  const companyQuery = context.company ? `?companyId=${context.company.id}` : "";

  function portalLinkClass(href: string) {
    const active = href === "/company" ? pathname === href : pathname.startsWith(href);
    return active ? "portalNavLink portalNavLinkActive" : "portalNavLink";
  }

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

        <nav className="portalNav" aria-label="Company navigation">
          <Link
            aria-label="Dashboard"
            className={portalLinkClass("/company")}
            data-tooltip="Dashboard"
            href={`/company${companyQuery}`}
          >
            <NavIcon name="home" />
          </Link>
          <Link
            aria-label="Company profile"
            className={portalLinkClass("/company/profile")}
            data-tooltip="Company profile"
            href={`/company/profile${companyQuery}`}
          >
            <NavIcon name="profile" />
          </Link>
          <Link
            aria-label="Positions"
            className={portalLinkClass("/company/positions")}
            data-tooltip="Positions"
            href={`/company/positions${companyQuery}`}
          >
            <NavIcon name="positions" />
          </Link>
          <Link
            aria-label="Time slots"
            className={portalLinkClass("/company/slots")}
            data-tooltip="Time slots"
            href={`/company/slots${companyQuery}`}
          >
            <NavIcon name="schedule" />
          </Link>
          <Link
            aria-label="Appointments"
            className={portalLinkClass("/company/appointments")}
            data-tooltip="Appointments"
            href={`/company/appointments${companyQuery}`}
          >
            <NavIcon name="appointments" />
          </Link>
          {context.role === "admin" && (
            <Link
              aria-label="Back to administration"
              className="portalNavLink"
              data-tooltip="Back to administration"
              href="/admin"
            >
              <NavIcon name="back" />
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
