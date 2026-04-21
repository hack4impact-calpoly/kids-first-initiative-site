"use client";
import { useState } from "react"; // imports useState so we can track the access code and copy status
import styles from "./teacherLogin.module.css";

export default function TeacherLoginPage() {
  const [accessCode, setAccessCode] = useState("ABC-123-XYZ"); // holds the current access code being displayed
  const [copied, setCopied] = useState(false); // tracks whether to show "Copied!" or "Copy Code" on the button

  const handleCopy = () => {
    navigator.clipboard.writeText(accessCode); // copies the access code to the user's clipboard
    setCopied(true); // switches button text to "Copied!"
    setTimeout(() => setCopied(false), 2000); // after 2 seconds, switches button text back to "Copy Code"
  };

  const handleGenerateNew = () => {
    // to generate new code
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // characters to pick from
    const rand = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); // picks n random characters
    setAccessCode(`${rand(3)}-${rand(3)}-${rand(3)}`); // sets a new random code in format XXX-XXX-XXX
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Your Access Code</h1>

      <div className={styles.card}>
        <p className={styles.cardHeading}>Share this code with your students to grant them access</p>

        <p className={styles.cardSubtext}>
          Your student will need this code to create their account and link it to your teacher dashboard.
        </p>

        <div className={styles.codeDisplay}>
          <span className={styles.codeText}>{accessCode}</span>
        </div>

        <button onClick={handleCopy} className={styles.buttonCopy}>
          {copied ? "Copied!" : "Copy Code"}
        </button>

        <button onClick={handleGenerateNew} className={styles.buttonGenerate}>
          Generate New Code
        </button>
      </div>
    </div>
  );
}
