"use client";

import { SignIn } from "@clerk/nextjs";
import { useState } from "react";
import { useParams } from "next/navigation";

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          height: "60px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          padding: "0 1.5rem",
        }}
      >
        <div style={{ width: "80px", height: "30px", backgroundColor: "#e5e7eb", borderRadius: "4px" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "3rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "2rem" }}>Hello!</h1>
        <div style={{ border: "1px solid #d1d5db", borderRadius: "0.75rem", padding: "2rem", width: "560px" }}>
          <p style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "1rem" }}>
            Enter your access code{" "}
            <span title="Ask your teacher for the access code" style={{ cursor: "help", color: "#6b7280" }}>
              ⓘ
            </span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="text"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{
                flex: 1,
                padding: "0.75rem 1rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                outline: "none",
              }}
            />
            <button
              onClick={handleSubmit}
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "2px solid #111",
                backgroundColor: "white",
                fontSize: "1.25rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              →
            </button>
          </div>
          {error && <p style={{ color: "red", fontSize: "0.875rem", marginTop: "0.5rem" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
