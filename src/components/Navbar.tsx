import { Button, Link, Text } from "@chakra-ui/react";
import { textStyles } from "@/styles/textStyles";

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
        <Button className="signOut" onClick={undefined}>
          <Text>Sign-out</Text>
        </Button>
      </nav>
    </header>
  );
}
