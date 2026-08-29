import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/database/db";
import { getRequestActor, requireAdmin } from "@/lib/server/apiAuthorization";
import { ClassroomSessionState } from "@/lib/server/classroomHistory";
import { ALL_SESSION_STATES, DEFAULT_ADMIN_CLASS_LIMIT, loadAdminAnalytics } from "@/lib/server/adminAnalytics";

const MAX_CLASS_LIMIT = 200;

function parseStates(value: string | null): ClassroomSessionState[] | undefined {
  if (!value) return undefined;
  const requested = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry): entry is ClassroomSessionState => (ALL_SESSION_STATES as string[]).includes(entry));
  return requested.length ? requested : undefined;
}

function parseDate(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ADMIN_CLASS_LIMIT;
  return Math.min(parsed, MAX_CLASS_LIMIT);
}

export async function GET(request: NextRequest) {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    await connectDB();

    const params = request.nextUrl.searchParams;
    const analytics = await loadAdminAnalytics({
      classId: params.get("classId") ?? undefined,
      educatorId: params.get("educatorId") ?? undefined,
      gameId: params.get("gameId") ?? undefined,
      from: parseDate(params.get("from")),
      to: parseDate(params.get("to")),
      states: parseStates(params.get("states")),
      limit: parseLimit(params.get("limit")),
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/analytics error:", error);
    return NextResponse.json({ error: "Failed to load analytics." }, { status: 500 });
  }
}
