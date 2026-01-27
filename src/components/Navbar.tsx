import { Link } from "@chakra-ui/react";

export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navList">
        <Link href="/home">Home</Link>
        <Link href="/blog">Dashboard</Link>
        <Link href="/portfolio">Profile</Link>
      </nav>
    </header>
  );
}
