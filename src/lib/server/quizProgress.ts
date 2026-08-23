import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import { RequestActor } from "@/lib/server/apiAuthorization";
import { resolveDataPrincipalFromCredential } from "@/lib/server/classroomAuthorization";

type QuizKey = "penguinRunQuiz" | "statesOfMatterQuiz";

type QuizBeforeScores = {
  penguinRunScoreBefore?: unknown;
  statesOfMatterScoreBefore?: unknown;
};

function getBeforeScoreField(quizKey: QuizKey): keyof QuizBeforeScores {
  return quizKey === "penguinRunQuiz" ? "penguinRunScoreBefore" : "statesOfMatterScoreBefore";
}

/**
 * Reads the baseline a student recorded before playing, for the principal that owns it.
 *
 * The owner is resolved from the classroom cookie or the signed-in user, and deliberately nothing
 * else. A student whose classroom cookie has lapsed reads their personal record and sees no
 * baseline, which is correct: `QuizExperience` derives the *write* owner from the localStorage
 * snapshot, so the server cannot tell whether the matching after-score will be written to the
 * participant record or the personal one. Recovering the classroom baseline here without the same
 * signal on the write path would show the student a growth number against a record the result is
 * never saved to, and leave the educator dashboard reporting no gain at all. Closing that gap needs
 * the classroom context carried into the request, not inferred from it.
 */
export async function getPreviousQuizScore(
  quizKey: QuizKey,
  actor: RequestActor,
  classroomCredential?: string,
): Promise<number> {
  try {
    // Resolving the principal reads the participant and session collections, so the connection has
    // to be open before that call, not merely before the quiz lookup.
    await connectDB();

    const principal = await resolveDataPrincipalFromCredential(classroomCredential, actor);
    if (!principal.ok || !principal.value.ownerId) return -1;

    const quiz = await Quiz.findOne({ clerkId: principal.value.ownerId }).lean<QuizBeforeScores | null>();
    const score = quiz?.[getBeforeScoreField(quizKey)];

    return typeof score === "number" ? score : -1;
  } catch (error) {
    // "No previous score" is a state the quiz already renders. Letting a transient database error
    // escape would fail the whole server-rendered page instead.
    console.error("getPreviousQuizScore error:", error);
    return -1;
  }
}
