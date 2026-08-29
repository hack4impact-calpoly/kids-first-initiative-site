import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AppChrome from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "Kids First Initiative",
  description: "Learn about states of matter, energy, and motion through games built for classrooms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
