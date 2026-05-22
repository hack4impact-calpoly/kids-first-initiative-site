import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();

    const gameData = await GameData.find({}).sort({ lastUpdated: -1 }).lean();
    return NextResponse.json(gameData, { status: 200 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const gamedata = await GameData.create(body);
    return NextResponse.json(gamedata, { status: 201 });
  } catch (err: any) {
    console.error("Caught an error", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
