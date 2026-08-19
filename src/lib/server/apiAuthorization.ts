import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const APP_ROLES = ["player", "parent", "educator", "admin"] as const;
export const SELF_ASSIGNABLE_ROLES = ["player", "parent", "educator"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type RequestActor = {
  userId: string | null;
  role: AppRole | null;
};

export type AuthorizationResult<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

export function normalizeRole(value: unknown): AppRole | null {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole) ? (value as AppRole) : null;
}

export function normalizeSelfAssignableRole(value: unknown): Exclude<AppRole, "admin"> {
  return typeof value === "string" && SELF_ASSIGNABLE_ROLES.includes(value as Exclude<AppRole, "admin">)
    ? (value as Exclude<AppRole, "admin">)
    : "player";
}

export async function getRequestActor(): Promise<RequestActor> {
  const { userId, sessionClaims } = await auth();
  return {
    userId,
    role: normalizeRole(sessionClaims?.role),
  };
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function requireSignedIn(actor: RequestActor): AuthorizationResult<RequestActor & { userId: string }> {
  if (!actor.userId) {
    return { ok: false, response: unauthorized() };
  }

  return { ok: true, value: { ...actor, userId: actor.userId } };
}

export function requireAdmin(
  actor: RequestActor,
): AuthorizationResult<RequestActor & { userId: string; role: "admin" }> {
  const signedIn = requireSignedIn(actor);
  if (!signedIn.ok) return signedIn;

  if (signedIn.value.role !== "admin") {
    return { ok: false, response: forbidden("Administrator access required") };
  }

  return {
    ok: true,
    value: { ...signedIn.value, role: "admin" },
  };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
