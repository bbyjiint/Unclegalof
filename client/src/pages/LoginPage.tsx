import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { AuthHeroShell } from "../components/auth/AuthHeroShell";
import { IconLockOutline, IconUserOutline } from "../components/auth/AuthIcons";
import { getDefaultRouteForRole } from "../lib/roleRoutes";

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
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    try {
      setSubmitting(true);
      const user = await login({ email, password });
      navigate(getDefaultRouteForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthHeroShell>
      <p className="auth-hero-brand">โต๊ะลพบุรี</p>

      <h1 className="sr-only">เข้าสู่ระบบ</h1>

      <form className="auth-hero-form" onSubmit={handleSubmit} noValidate>
        <div
          className={`auth-line-field${error ? " auth-line-field--error" : ""}`}
        >
          <span className="auth-line-field__icon">
            <IconUserOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="login-email">
            อีเมล
          </label>
          <input
            id="login-email"
            className="auth-line-input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="EMAIL"
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
        </div>

        <div
          className={`auth-line-field${error ? " auth-line-field--error" : ""}`}
        >
          <span className="auth-line-field__icon">
            <IconLockOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="login-password">
            รหัสผ่าน
          </label>
          <input
            id="login-password"
            className="auth-line-input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD"
            disabled={submitting}
            aria-invalid={Boolean(error)}
          />
        </div>

        {error ? (
          <div className="auth-hero-alert" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="auth-hero-submit"
          disabled={submitting}
        >
          {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <button
        type="button"
        className="auth-hero-forgot"
        title="ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน"
      >
        ลืมรหัสผ่าน?
      </button>

      <p className="auth-hero-signup">
        ต้องการบัญชี?{" "}
        <Link className="auth-hero-signup-link" to="/signup">
          ดูวิธีได้บัญชี
        </Link>
      </p>
    </AuthHeroShell>
  );
}
