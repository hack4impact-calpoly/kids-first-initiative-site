export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navList">
        <link href="/home">Home</link>
        <link href="/blog">Dashboard</link>
        <link href="/profile">Profile</link>
        <button className="signOut" onClick={() => null}></button>
      </nav>
    </header>
  );
}
