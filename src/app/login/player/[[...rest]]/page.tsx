"use client";

import { SignIn } from "@clerk/nextjs";
import { useState } from "react";
import { useParams } from "next/navigation";
import styles from "../../../../styles/playerLogin.module.css";

export default function PlayerLoginPage() {
  const params = useParams();
  const rest = params?.rest as string[] | undefined;
  const isClerkRoute = rest && rest.length > 0;

  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!accessCode.trim()) {
      setError("Please enter an access code.");
      return;
    }
    console.log("Access code submitted:", accessCode);
  };

  //if handling a sub royte show sign in
  if (isClerkRoute) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <SignIn path="/login/player" />
      </div>
    );
  }

  // otherwise show the access code page
  return (
    <div className={styles.page}>
      <div className={styles.navbar}>
        <div className={styles.navbarLogo} />
      </div>

      <div className={styles.body}>
        <h1 className={styles.title}>Hello!</h1>

        <div className={styles.card}>
          <p className={styles.cardLabel}>
            Enter your access code{" "}
            <span title="Ask your teacher for the access code" className={styles.infoIcon}>
              {" "}
              ⓘ
            </span>
          </p>

          <div className={styles.inputRow}>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className={styles.input}
            />
            <button onClick={handleSubmit} className={styles.submitButton}>
              →
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
