import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import { reopenClassroomClass } from "@/lib/server/classroomClasses";
import { getTeacherForCurrentUser } from "@/lib/server/educatorClassroom";

export async function POST(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Reopening changes who can join, so it stays with the owning educator. Admin read access does
    // not extend to acting on another educator's class.
    const teacherResult = await getTeacherForCurrentUser(userId);
    if ("error" in teacherResult) return teacherResult.error;

    const { classId } = await params;
    const result = await reopenClassroomClass({ classId, teacherId: teacherResult.teacherId });

    if (!result.ok) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        reopened: result.reopened,
        classId: result.classId,
        sessionId: result.sessionId,
        accessCode: result.accessCode,
        expiresAt: result.expiresAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST /api/classroom-sessions/history/:classId/reopen error:", error);
    return NextResponse.json({ error: "Failed to reopen the class." }, { status: 500 });
  }
}
