"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";
import type { AppPermission } from "@/lib/permissions";

export default function RequirePermission({
  permission,
  children,
}: {
  permission: AppPermission;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const authorization = useAuthorization();
  const allowed = authorization.can(permission);
  const { defaultRoute, loading, userId } = authorization;

  useEffect(() => {
    if (loading || allowed) return;
    router.replace(userId ? defaultRoute : "/auth?mode=login");
  }, [allowed, defaultRoute, loading, router, userId]);

  if (loading) {
    return <p className="p">Checking access...</p>;
  }

  if (!allowed) {
    return <p className="p">Redirecting to an authorized area...</p>;
  }

  return <>{children}</>;
}
