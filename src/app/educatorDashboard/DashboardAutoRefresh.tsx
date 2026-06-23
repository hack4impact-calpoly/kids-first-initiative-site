"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 5000;

export default function DashboardAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [router]);

  return null;
}
