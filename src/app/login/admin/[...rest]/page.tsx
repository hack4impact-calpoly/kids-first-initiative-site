"use client";

import { Flex } from "@chakra-ui/react";
import { SignIn } from "@clerk/nextjs";

const POST_SIGN_IN_ROUTE = "/login/admin";

export default function AdminClerkSignInPage() {
  return (
    <Flex minH="100vh" align="center" justify="center" bg="#F7F9FB" px={4}>
      <SignIn path="/login/admin" routing="path" forceRedirectUrl={POST_SIGN_IN_ROUTE} />
    </Flex>
  );
}
