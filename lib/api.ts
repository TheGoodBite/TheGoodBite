import { ZodError } from "zod";
import { ProviderError } from "@/lib/providerRuntime";
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
    entitlement: getEntitlement(profile.subscription_status),
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError)
    return jsonError(
      "Invalid request: " +
        error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      400,
    );
  if (error instanceof SyntaxError)
    return jsonError("Request body must be valid JSON.", 400);
  if (error instanceof ProviderError)
    return jsonError(error.message, error.status);
  if (error instanceof ApiError) return jsonError(error.message, error.status);
  console.error("meezany.api.error", {
    type: error instanceof Error ? error.name : "unknown",
  });
  return jsonError(
    "The service could not complete this request. Please try again.",
    500,
  );
}
