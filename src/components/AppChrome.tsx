"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

type AppChromeProps = {
  children: ReactNode;
};

const HIDE_NAVBAR_PREFIXES = ["/login", "/sign-up", "/signupredirect", "/home"];

export default function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const shouldHideNavbar = pathname ? HIDE_NAVBAR_PREFIXES.some((prefix) => pathname.startsWith(prefix)) : false;

  return (
    <>
      {shouldHideNavbar ? null : <Navbar />}
      {children}
    </>
  );
}
