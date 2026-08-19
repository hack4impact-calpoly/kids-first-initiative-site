import { NextResponse } from "next/server";
import { getRequestActor, requireAdmin } from "@/lib/server/apiAuthorization";

export async function GET() {
  try {
    const admin = requireAdmin(await getRequestActor());
    if (!admin.ok) return admin.response;

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/auth/admin-access error:", error);
    return NextResponse.json({ error: "Failed to verify admin access" }, { status: 500 });
  }
}
