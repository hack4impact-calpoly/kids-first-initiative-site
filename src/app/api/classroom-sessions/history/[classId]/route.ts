import { NextResponse } from "next/server";
import connectDB from "@/database/db";
import { getRequestActor, unauthorized } from "@/lib/server/apiAuthorization";
import { canEducatorReadClassroom } from "@/lib/server/classroomAuthorization";
import { loadClassDetail } from "@/lib/server/classroomClasses";
import { findEducatorTeacher } from "@/lib/server/educatorClassroom";

// Unauthorized reads answer 404 rather than 403 so one educator cannot probe for another's classes.
const notFound = () => NextResponse.json({ error: "Class not found." }, { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const actor = await getRequestActor();
    if (!actor.userId) return unauthorized();

    await connectDB();

    const { classId } = await params;
    if (!(await canEducatorReadClassroom(actor, classId))) return notFound();

    // Admins already cleared authorization above and read across educators; everyone else stays
    // scoped to the classes they own.
    let teacherScope: string | null = null;
    if (actor.role !== "admin") {
      // Read-only: viewing a class must not create an educator profile as a side effect.
      const educator = await findEducatorTeacher(actor.userId);
      if (!educator?.teacherId) return notFound();
      teacherScope = String(educator.teacherId);
    }

    const detail = await loadClassDetail(classId, teacherScope);
    if (!detail) return notFound();

    return NextResponse.json({ class: detail }, { status: 200 });
  } catch (error) {
    console.error("GET /api/classroom-sessions/history/:classId error:", error);
    return NextResponse.json({ error: "Failed to load class history." }, { status: 500 });
  }
}
