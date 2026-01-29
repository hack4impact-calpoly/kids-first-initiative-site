import { Link } from "@chakra-ui/react";

export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navList">
        <Link href="/home">
          <button className="home">
            <text>Home</text>
          </button>
        </Link>
        <Link href="/dashboard">
          <button className="dashboard">
            <text>Dashboard</text>
          </button>
        </Link>
        <Link href="/profile">
          <button className="profile">
            <text>Profile</text>
          </button>
        </Link>
        <button className="signOut" onClick={undefined}>
          <text>Sign-out</text>
        </button>
      </nav>
    </header>
  );
}
