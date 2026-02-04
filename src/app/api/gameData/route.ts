import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { saveId: string } }) {
  await connectDB();

  const data = await GameData.findOne({ saveId: params.saveId });

  if (!data) {
    return NextResponse.json({ error: "Save not found" }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}
