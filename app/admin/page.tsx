"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  company_name: string;
  owner_user_id: string;
};

export default function AdminDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      const { data, error: companyError } = await supabase
        .from("companies")
        .select("id, company_name, owner_user_id")
        .order("company_name");

      if (companyError) setError(companyError.message);
      setCompanies((data ?? []) as Company[]);
      setLoading(false);
    }

    void loadCompanies();
  }, []);

  return (
    <main style={pageStyle}>
      <section className="card" style={shellStyle}>
        <AppNav />

        <div style={{ padding: 22 }}>
          <div className="kicker">ADMINISTRATION</div>
          <h1 className="h1" style={{ fontSize: 36, marginTop: 8 }}>
            CareerKey Admin
          </h1>
          <p className="p" style={{ maxWidth: 760 }}>
            Manage shared recruiting data and enter a company workspace with an explicit
            company context. Administrator access is permission-based and still enforced by
            Supabase policies.
          </p>

          <div className="btnRow" style={{ marginTop: 20 }}>
            <Link className="btn btnPrimary" href="/admin/positions">
              Manage all positions
            </Link>
          </div>

          <h2 style={{ margin: "30px 0 6px" }}>Company workspaces</h2>
          <p className="p">Choose a company to inspect and manage its portal.</p>

          {loading ? (
            <p className="p" style={{ marginTop: 18 }}>Loading companies...</p>
          ) : error ? (
            <p className="p" style={{ marginTop: 18 }}>Unable to load companies: {error}</p>
          ) : companies.length === 0 ? (
            <p className="p" style={{ marginTop: 18 }}>No companies have registered yet.</p>
          ) : (
            <div className="grid">
              {companies.map((company) => (
                <article className="card" style={{ gridColumn: "span 6" }} key={company.id}>
                  <div className="kicker">COMPANY</div>
                  <h3 className="cardTitle" style={{ marginTop: 8 }}>{company.company_name}</h3>
                  <p className="p" style={{ fontSize: 12 }}>
                    Owner: {company.owner_user_id}
                  </p>
                  <div className="btnRow">
                    <Link className="btn" href={`/company?companyId=${company.id}`}>
                      Open workspace
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
};

const shellStyle: React.CSSProperties = {
  width: "min(1080px, 100%)",
  margin: "0 auto",
  padding: 0,
  overflow: "hidden",
};
