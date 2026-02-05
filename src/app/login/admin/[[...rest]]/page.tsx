"use client";

import { SignIn } from "@clerk/nextjs";
import { Flex, Box } from "@chakra-ui/react";

export default function AdminLoginPage() {
  return (
    <>
      <Flex height="100vh" alignItems="center" justifyContent="center">
        <Box transform="scale(1.2)">
          <SignIn
            path="/login/admin"
            appearance={{
              elements: {
                footerAction: { display: "none" }, // Hides the "Sign Up" link
              },
            }}
          />
        </Box>
      </Flex>
    </>
  );
}
