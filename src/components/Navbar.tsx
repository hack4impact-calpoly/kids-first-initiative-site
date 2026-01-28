export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navList">
        <a href="/home">
          <button className="home">
            <text>Home</text>
          </button>
        </a>
        <a href="/dashboard">
          <button className="dashboard">
            <text>Dashboard</text>
          </button>
        </a>
        <a href="/profile">
          <button className="profile">
            <text>Profile</text>
          </button>
        </a>
        <button className="signOut" onClick={undefined}>
          <text>Sign-out</text>
        </button>
      </nav>
    </header>
  );
}
