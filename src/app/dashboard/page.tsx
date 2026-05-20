import { auth } from "@clerk/nextjs/server";
import connectDB from "@/database/db";
import User from "@/database/userSchema";
import { redirect } from "next/navigation";

//Redirect the user to the proper dashboard

export default async function Dashboard() {
  const { userId, sessionClaims } = await auth();

  if (userId) {
    await connectDB();
    const dbUser = await User.findOne({ clerkId: userId }).lean<{ role?: string } | null>();
    if (dbUser?.role === "admin") {
      redirect("/adminDashboard");
    }
    if (dbUser?.role === "parent") {
      redirect("/parentDashboard");
    }
    if (dbUser?.role === "educator") {
      redirect("/educatorDashboard");
    }
  }

  if (sessionClaims?.role === "admin") {
    redirect("/adminDashboard");
  }

  redirect("/playerDashboard");
}
