import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

//Redirect the user to the proper dashboard

export default async function Dashboard() {
  const { sessionClaims } = await auth();
  console.log("sessionClaims:", sessionClaims);
  console.log("role:", sessionClaims?.role);
  const role = sessionClaims?.role;

  if (role === "admin") {
    redirect("/adminDashboard");
  }

  redirect("/playerDashboard");
}
