"use client";

import RequirePermission from "@/components/RequirePermission";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="admin.portal">
      {children}
    </RequirePermission>
  );
}
