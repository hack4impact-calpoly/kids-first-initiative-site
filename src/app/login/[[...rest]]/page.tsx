"use client";

import { Box, Button, VStack, Heading, Flex } from "@chakra-ui/react";
import Link from "next/link";
import styles from "../../../styles/loginSelection.module.css";

export default function LoginSelectionPage() {
  return (
    <div className={styles.container}>
      <VStack gap={8}>
        <Heading as="h1" size="xl" className={styles.heading}>
          Welcome! Who are you?
        </Heading>

        <div className={styles.cardRow}>
          {/*player*/}
          <Link href="/login/player" className={styles.cardLink}>
            <div className={`${styles.card} ${styles.cardPlayer}`}>
              <div className={styles.cardEmoji}>🎮</div>
              <div className={styles.cardLabel}>I&apos;m a Player</div>
            </div>
          </Link>

          {/*teacher*/}
          <Link href="/login/teacher" className={styles.cardLink}>
            <div className={`${styles.card} ${styles.cardTeacher}`}>
              <div className={styles.cardEmoji}>🍎</div>
              <div className={styles.cardLabel}>I&apos;m a Teacher</div>
            </div>
          </Link>

          {/*admin*/}
          <Link href="/login/admin" className={styles.cardLink}>
            <div className={`${styles.card} ${styles.cardAdmin}`}>
              <div className={styles.cardEmoji}>🔑</div>
              <div className={styles.cardLabel}>I&apos;m an Admin</div>
            </div>
          </Link>
        </div>
      </VStack>
    </div>
  );
}
