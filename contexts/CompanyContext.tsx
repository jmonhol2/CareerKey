"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";
import { supabase } from "@/lib/supabaseClient";
import { hasPermission, type AppRole } from "@/lib/permissions";

export type AccessibleCompany = {
  id: string;
  owner_user_id: string;
  company_name: string;
};

type CompanyContextValue = {
  loading: boolean;
  error: string | null;
  role: AppRole | null;
  userId: string | null;
  company: AccessibleCompany | null;
  availableCompanies: AccessibleCompany[];
  selectCompany: (companyId: string) => void;
  refreshCompany: () => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyContextProvider({ children }: { children: React.ReactNode }) {
  const authorization = useAuthorization();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requestedCompanyId = searchParams.get("companyId");
  const [companies, setCompanies] = useState<AccessibleCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCompanies() {
      if (authorization.loading) return;

      if (!authorization.userId || !hasPermission(authorization.role, "company.portal")) {
        if (active) setLoadingCompanies(false);
        return;
      }

      setLoadingCompanies(true);
      setError(null);

      let query = supabase
        .from("companies")
        .select("id, owner_user_id, company_name")
        .order("company_name");

      if (authorization.role !== "admin") {
        query = query.eq("owner_user_id", authorization.userId);
      }

      const { data, error: companyError } = await query;
      if (!active) return;

      if (companyError) {
        setCompanies([]);
        setError(companyError.message);
      } else {
        setCompanies((data ?? []) as AccessibleCompany[]);
      }

      setLoadingCompanies(false);
    }

    void loadCompanies();

    return () => {
      active = false;
    };
  }, [authorization.loading, authorization.role, authorization.userId, refreshKey]);

  const company = useMemo(() => {
    if (!companies.length) return null;
    if (authorization.role !== "admin") return companies[0];
    return companies.find((item) => item.id === requestedCompanyId) ?? companies[0];
  }, [authorization.role, companies, requestedCompanyId]);

  function selectCompany(companyId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("companyId", companyId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const value: CompanyContextValue = {
    loading: authorization.loading || loadingCompanies,
    error: authorization.error || error,
    role: authorization.role,
    userId: authorization.userId,
    company,
    availableCompanies: companies,
    selectCompany,
    refreshCompany: async () => setRefreshKey((current) => current + 1),
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanyContext() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompanyContext must be used within CompanyContextProvider");
  }
  return context;
}
