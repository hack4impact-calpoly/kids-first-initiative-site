import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import connectDB from "@/database/db";
import User from "@/database/userSchema";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    return redirect("/login");
  }

  await connectDB();
  // our userSchema is loosely typed, so we need to clarify what the role is when using lean()
  const user = await User.findOne({ clerkId: userId }).lean<{ role: string } | null>();

  if (!user || user.role !== "admin") {
    return redirect("/playerDashboard");
  }

  return <>{children}</>;
}
