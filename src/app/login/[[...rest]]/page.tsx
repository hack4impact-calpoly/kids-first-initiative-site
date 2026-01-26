import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      {/* This inner div scales the component up by 20% (1.2). 
         You can change 1.2 to 1.3 or 1.5 if you want it even bigger.
      */}
      <div style={{ transform: "scale(1.2)" }}>
        <SignIn path="/login" />
      </div>
    </div>
  );
}
