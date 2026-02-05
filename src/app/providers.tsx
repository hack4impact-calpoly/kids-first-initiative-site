"use client";

import type { ReactNode } from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ClerkProvider } from "@clerk/nextjs";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    </ClerkProvider>
  );
}
