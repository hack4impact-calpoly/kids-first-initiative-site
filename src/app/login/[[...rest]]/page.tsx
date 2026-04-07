"use client";

import { Box, Button, VStack, Heading, Flex } from "@chakra-ui/react";
import Link from "next/link";

export default function LoginSelectionPage() {
  return (
    <Flex
      alignItems="center"
      justifyContent="center"
      height="100vh"
      backgroundColor="#f0f4ff"
      fontFamily="'Nunito', sans-serif"
    >
      <VStack gap={8}>
        <Heading as="h1" size="xl" color="#1e1e2e">
          Welcome! Who are you?
        </Heading>

        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {/* Player card */}
          <Link href="/login/player" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#4f46e5",
                color: "white",
                borderRadius: "1.25rem",
                padding: "2.5rem 3rem",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(79,70,229,0.35)",
                transition: "transform 0.15s ease",
                width: "200px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎮</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>I&apos;m a Player</div>
            </div>
          </Link>

          {/* Teacher card */}
          <Link href="/login/teacher" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#0ea5e9",
                color: "white",
                borderRadius: "1.25rem",
                padding: "2.5rem 3rem",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(14,165,233,0.35)",
                transition: "transform 0.15s ease",
                width: "200px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🍎</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>I&apos;m a Teacher</div>
            </div>
          </Link>

          {/* Admin card */}
          <Link href="/login/admin" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#6b7280",
                color: "white",
                borderRadius: "1.25rem",
                padding: "2.5rem 3rem",
                textAlign: "center",
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(107,114,128,0.35)",
                transition: "transform 0.15s ease",
                width: "200px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🔑</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>I&apos;m an Admin</div>
            </div>
          </Link>
        </div>
      </VStack>
    </Flex>
  );
}
