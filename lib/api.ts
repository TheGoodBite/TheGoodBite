import { getEntitlement } from "@/lib/entitlements";
import { ensureProfile, getUserFromRequest } from "@/lib/supabase";
import type { AuthUser, Entitlement } from "@/lib/types";

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function requireUserAndEntitlement(request: Request): Promise<{
  user: AuthUser;
  entitlement: Entitlement;
}> {
  const user = await getUserFromRequest(request);
  if (!user) throw new ApiError("Sign in required.", 401);

  const profile = await ensureProfile(user);
  return {
    user,
    entitlement: getEntitlement(profile.subscription_status)
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) return jsonError(error.message, error.status);
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return jsonError(message, 500);
}
