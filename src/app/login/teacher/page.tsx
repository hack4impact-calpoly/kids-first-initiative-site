"use client";
import { useState } from "react"; // imports useState so we can track the access code and copy status

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "2rem" }}>Your Access Code</h1> {/*page title*/}
      {/* the biggest box, just plain white */}
      <div
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "0.75rem",
          padding: "2rem",
          width: "420px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <p style={{ fontWeight: 600, margin: 0 }}>Share this code with your students to grant them access</p>{" "}
        {/* card heading */}
        <p style={{ color: "#6b7280", fontSize: "0.875rem", margin: 0 }}>
          Your student will need this code to create their account and link it to your teacher dashboard.{" "}
          {/* explanation text */}
        </p>
        {/* access code in big font XXX-XXX-XXX */}
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            padding: "1.25rem",
            textAlign: "center",
            backgroundColor: "#f9fafb",
          }}
        >
          <span style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "0.2em", fontFamily: "monospace" }}>
            {accessCode} {/* prints whatever accesscode is at the time */}
          </span>
        </div>
        {/* copy code button */}
        <button
          onClick={handleCopy}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#9ca3af",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied!" : "Copy Code"} {/* shows "Copied!" if copied is true, otherwise "Copy Code" */}
        </button>
        {/* button for generating a new code */}
        <button
          onClick={handleGenerateNew}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "white",
            color: "#111",
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Generate New Code
        </button>
      </div>
    </div>
  );
}
