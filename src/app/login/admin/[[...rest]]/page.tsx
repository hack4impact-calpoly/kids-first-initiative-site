"use client";

import { SignIn } from "@clerk/nextjs";
import { Flex, Box, Heading, VStack, Text } from "@chakra-ui/react";
import styles from "../../../../styles/adminLogin.module.css";

export default function AdminLoginPage() {
  return (
    <div className={styles.container}>
      <VStack gap={8}>
        <VStack gap={2} mb={6} className={styles.headerText}>
          <Heading as="h1" size="xl" className={styles.heading}>
            Welcome back, Admin!
          </Heading>
          <Text className={styles.subtitle}>Please sign in to access the dashboard.</Text>
        </VStack>

        <div className={styles.signInWrapper}>
          <SignIn
            path="/login/admin"
            forceRedirectUrl="/adminDashboard"
            appearance={{
              elements: {
                footerAction: { display: "none" },
                socialButtonsBlockButton: { display: "none" },
                dividerRow: { display: "none" },
              },
            }}
          />
        </div>
      </VStack>
    </div>
  );
}
