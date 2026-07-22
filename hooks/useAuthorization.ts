"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  defaultRouteForRole,
  hasPermission,
  isAppRole,
  type AppPermission,
  type AppRole,
} from "@/lib/permissions";

type AuthorizationState = {
  loading: boolean;
  userId: string | null;
  role: AppRole | null;
  error: string | null;
};

export function useAuthorization() {
  const [state, setState] = useState<AuthorizationState>({
    loading: true,
    userId: null,
    role: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    async function loadAuthorization() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        setState({ loading: false, userId: null, role: null, error: null });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setState({
          loading: false,
          userId: user.id,
          role: null,
          error: profileError.message,
        });
        return;
      }

      setState({
        loading: false,
        userId: user.id,
        role: isAppRole(profile?.role) ? profile.role : null,
        error: null,
      });
    }

    void loadAuthorization();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadAuthorization();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const can = useCallback(
    (permission: AppPermission) => hasPermission(state.role, permission),
    [state.role]
  );
  const defaultRoute = useMemo(() => defaultRouteForRole(state.role), [state.role]);

  return {
    ...state,
    can,
    defaultRoute,
  };
}
