import connectDB from "@/database/db";
import Quiz from "@/database/quizSchema";
import { RequestActor } from "@/lib/server/apiAuthorization";
import {
  findActiveClassroomParticipantForUser,
  resolveDataPrincipalFromCredential,
} from "@/lib/server/classroomAuthorization";

type QuizKey = "penguinRunQuiz" | "statesOfMatterQuiz";

type QuizBeforeScores = {
  penguinRunScoreBefore?: unknown;
  statesOfMatterScoreBefore?: unknown;
};

function getBeforeScoreField(quizKey: QuizKey): keyof QuizBeforeScores {
  return quizKey === "penguinRunQuiz" ? "penguinRunScoreBefore" : "statesOfMatterScoreBefore";
}

async function readBeforeScore(ownerId: string, quizKey: QuizKey) {
  const quiz = await Quiz.findOne({ clerkId: ownerId }).lean<QuizBeforeScores | null>();
  const score = quiz?.[getBeforeScoreField(quizKey)];
  return typeof score === "number" && score >= 0 ? score : -1;
}

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

    const score = await readBeforeScore(principal.value.ownerId, quizKey);
    if (score >= 0 || principal.value.classroom || !actor.userId) return score;

    // The classroom cookie can lapse while the student is still an active participant, in which
    // case their baseline was written under the participant key and the personal record has
    // nothing. Only consulted when the personal record has no score, so a real personal baseline
    // is never overridden by a classroom one.
    const participant = await findActiveClassroomParticipantForUser(actor.userId);
    if (!participant) return -1;

    return readBeforeScore(`participant:${participant.participantId}`, quizKey);
  } catch (error) {
    // "No previous score" is a state the quiz already renders. Letting a transient database error
    // escape would fail the whole server-rendered page instead.
    console.error("getPreviousQuizScore error:", error);
    return -1;
  }
}
