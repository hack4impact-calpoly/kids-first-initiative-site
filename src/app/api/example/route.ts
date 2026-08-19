import connectDB from "@/database/db";
import { NextResponse } from "next/server";
import { getRequestActor, requireAdmin } from "@/lib/server/apiAuthorization";

/**
 * Example GET API route
 * @returns {message: string}
 */
export async function GET() {
  const admin = requireAdmin(await getRequestActor());
  if (!admin.ok) return admin.response;

  await connectDB();
  return NextResponse.json({ message: "Hello from the API!" });
}
