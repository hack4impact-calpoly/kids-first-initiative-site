import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import { loadTeacherClassSummaries } from "@/lib/server/classroomClasses";
import { getTeacherForCurrentUser } from "@/lib/server/educatorClassroom";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const teacherResult = await getTeacherForCurrentUser(userId);
    if ("error" in teacherResult) return teacherResult.error;

    const summaries = await loadTeacherClassSummaries(teacherResult.teacherId);

    return NextResponse.json(
      {
        classes: summaries.map((summary) => ({
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
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/classroom-sessions/history error:", error);
    return NextResponse.json({ error: "Failed to load classroom history." }, { status: 500 });
  }
}
