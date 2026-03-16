import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await login({ email, password });
      navigate("/staff");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="landing">
      <section className="card" style={{ maxWidth: 420, margin: "32px auto" }}>
        <h3>Login</h3>
        <p style={{ marginBottom: 16 }}>Sign in with your real account to continue.</p>

        <form onSubmit={handleSubmit} className="form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 12, marginTop: 4 }}>
              {error}
            </p>
          )}

          <button type="submit" className="vbtn" style={{ marginTop: 8 }} disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 12 }}>
          Don&apos;t have an account?{" "}
          <Link to="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}

