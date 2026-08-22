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

export async function getPreviousQuizScore(
  quizKey: QuizKey,
  actor: RequestActor,
  classroomCredential?: string,
): Promise<number> {
  const principal = await resolveDataPrincipalFromCredential(classroomCredential, actor);
  if (!principal.ok || !principal.value.ownerId) return -1;

  await connectDB();
  const quiz = await Quiz.findOne({ clerkId: principal.value.ownerId }).lean<QuizBeforeScores | null>();
  const score = quiz?.[getBeforeScoreField(quizKey)];
  return typeof score === "number" ? score : -1;
}
