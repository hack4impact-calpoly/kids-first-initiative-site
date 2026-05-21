import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import GameData from "@/database/gameDataSchema";
import styles from "./playerDashboard.module.css";

type PlayerGameCard = {
  gameId: "penguinRunGame" | "statesOfMatterGame";
  title: string;
  description: string;
  emoji: string;
  artClassName: string;
  saveId?: string;
};

const GAME_CARDS: Omit<PlayerGameCard, "saveId">[] = [
  {
    gameId: "penguinRunGame",
    title: "Penguin Run",
    description: "Build tracks to guide the penguin. Learn about gravity and friction.",
    emoji: "🐧",
    artClassName: "penguinArt",
  },
  {
    gameId: "statesOfMatterGame",
    title: "3 States of Matter",
    description: "Melt ice, boil water, condense steam. Fix the lab and learn matter phases.",
    emoji: "🧪",
    artClassName: "matterArt",
  },
];

export default async function PlayerDashboardPage() {
  const { userId } = await auth();
  await connectDB();

  const saves = await GameData.find(
    { userId, gameId: { $in: ["statesOfMatterGame", "penguinRunGame"] } },
    { gameId: 1, saveId: 1 },
  ).lean<Array<{ gameId: "statesOfMatterGame" | "penguinRunGame"; saveId?: string }>>();

  const cards: PlayerGameCard[] = GAME_CARDS.map((card) => ({
    ...card,
    saveId: saves.find((save) => save.gameId === card.gameId)?.saveId,
  }));

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Choose a Game</h1>
          <p className={styles.subtitle}>Pick a game to start learning.</p>
        </div>

        <div className={styles.cardsRow}>
          {cards.map((card) => {
            const quizRoutes: Record<string, string> = {
              penguinRunGame: "penguinRunQuiz",
              statesOfMatterGame: "threeStatesOfMatterQuiz",
            };
            const quizRoute = quizRoutes[card.gameId] || card.gameId;
            const href = card.saveId ? `/${quizRoute}?saveId=${card.saveId}` : `/${quizRoute}`;

            return (
              <article key={card.gameId} className={styles.card}>
                <div className={`${styles.art} ${styles[card.artClassName]}`}>
                  <span className={styles.emoji} aria-hidden="true">
                    {card.emoji}
                  </span>
                </div>

                <div className={styles.content}>
                  <h2 className={styles.cardTitle}>{card.title}</h2>
                  <p className={styles.cardDescription}>{card.description}</p>

                  <div className={styles.buttonRow}>
                    <span aria-hidden="true" />
                    <Link href={href} className={styles.playButton}>
                      Play
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
