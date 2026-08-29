import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import { RequestActor } from "@/lib/server/apiAuthorization";
import { resolveClassroomOwnerKeys, resolveDataPrincipalFromCredential } from "@/lib/server/classroomAuthorization";

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
 * `claimedParticipantId` is the classroom context carried into the request — the quiz page renders
 * on the server and cannot read the localStorage snapshot the write path uses, so the participant is
 * passed explicitly rather than inferred. Inferring it (say, "this signed-in user has an active
 * participant row") would misroute genuinely personal quizzes for anyone enrolled in a live class.
 *
 * The claim carries no extra authority: it is validated by the same
 * `authorizeClassroomParticipantWithCredential` path the write uses, which requires the participant
 * row to belong to the signed-in caller, or the claim to match the classroom cookie for a guest.
 */
export async function getPreviousQuizScore(
  quizKey: QuizKey,
  actor: RequestActor,
  classroomCredential?: string,
  claimedParticipantId?: string,
): Promise<number> {
  try {
    // Resolving the principal reads the participant and session collections, so the connection has
    // to be open before that call, not merely before the quiz lookup.
    await connectDB();

    const principal = await resolveDataPrincipalFromCredential(classroomCredential, actor, claimedParticipantId);
    if (!principal.ok || !principal.value.ownerId) return -1;

    // A student who rejoins a reopened class gets a new participant row, so their baseline sits
    // under an earlier owner key. Search the lineage, newest first, and take the first real score.
    const ownerIds = principal.value.classroom
      ? await resolveClassroomOwnerKeys(principal.value.classroom)
      : [principal.value.ownerId];

    const quizzes = await Quiz.find({ clerkId: { $in: ownerIds } })
      .select("clerkId penguinRunScoreBefore statesOfMatterScoreBefore")
      .lean<Array<QuizBeforeScores & { clerkId: string }>>();

    const field = getBeforeScoreField(quizKey);
    for (const ownerId of ownerIds) {
      const score = quizzes.find((quiz) => quiz.clerkId === ownerId)?.[field];
      if (typeof score === "number" && score >= 0) return score;
    }

    return -1;
  } catch (error) {
    // "No previous score" is a state the quiz already renders. Letting a transient database error
    // escape would fail the whole server-rendered page instead.
    console.error("getPreviousQuizScore error:", error);
    return -1;
  }
}
