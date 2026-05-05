import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

//Redirect the user to the proper dashboard

//ADD THESE TO ENV
//NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
//NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

export default async function Dashboard() {
  const { sessionClaims } = auth();
  console.log("sessionClaims:", sessionClaims);
  console.log("role:", sessionClaims?.role);
  const role = sessionClaims?.role;

  if (role === "admin") {
    redirect("/adminDashboard");
  }

  redirect("/playerDashboard");
}
