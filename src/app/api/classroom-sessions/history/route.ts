import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import {
  DEFAULT_CLASS_PAGE_SIZE,
  loadTeacherClassSummaries,
  parseClassPageLimit,
  parseClassPageOffset,
} from "@/lib/server/classroomClasses";
import { findEducatorTeacher } from "@/lib/server/educatorClassroom";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Read-only lookup: listing classes must not create an educator profile as a side effect.
    const educator = await findEducatorTeacher(userId);
    if (!educator) {
      return NextResponse.json({ error: "Educator access required." }, { status: 403 });
    }

    // An educator with no Teacher record has simply never run a class.
    if (!educator.teacherId) {
      return NextResponse.json(
        { classes: [], total: 0, offset: 0, hasMore: false, limit: DEFAULT_CLASS_PAGE_SIZE },
        { status: 200 },
      );
    }

    const limit = parseClassPageLimit(request.nextUrl.searchParams.get("limit"));
    const offset = parseClassPageOffset(request.nextUrl.searchParams.get("offset"));
    const page = await loadTeacherClassSummaries(educator.teacherId, new Date(), limit, offset);

    return NextResponse.json(
      {
        classes: page.classes.map((summary) => ({
          classId: summary.classId,
          title: summary.title,
          state: summary.state,
          createdAt: summary.createdAt,
          expiresAt: summary.expiresAt,
          closedAt: summary.closedAt,
          sessionCount: summary.sessions.length,
          reopenCount: summary.reopenCount,
          participantCount: summary.participantCount,
          gamesPlayed: summary.gamesPlayed,
          quizzesRecorded: summary.quizzesRecorded,
          averagePreQuizScore: summary.averagePreQuizScore,
          averagePostQuizScore: summary.averagePostQuizScore,
          lastActivityAt: summary.lastActivityAt,
          activeAccessCode: summary.activeAccessCode,
        })),
        total: page.total,
        offset: page.offset,
        hasMore: page.hasMore,
        limit,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/classroom-sessions/history error:", error);
    return NextResponse.json({ error: "Failed to load classroom history." }, { status: 500 });
  }
}
