"use client";

import { Box, VStack, HStack, Text, Avatar, Separator, Button, Link } from "@chakra-ui/react";
import { SignOutButton } from "@clerk/nextjs";

export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navList">
        <Link href="/home">
          <Button className="home">
            <Text>Home</Text>
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button className="dashboard">
            <Text>Dashboard</Text>
          </Button>
        </Link>
        <Link href="/profile">
          <Button className="profile">
            <Text>Profile</Text>
          </Button>
        </Link>
        {/* added signout button for testing purposes - Nathaniel */}
        <SignOutButton>
          <Button className="signOut" onClick={undefined}>
            <Text>Sign-out</Text>
          </Button>
        </SignOutButton>
      </nav>
    </header>
  );
}
