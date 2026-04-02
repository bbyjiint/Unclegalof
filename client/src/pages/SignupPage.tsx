import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { AuthHeroShell } from "../components/auth/AuthHeroShell";
import {
  IconBadgeOutline,
  IconEnvelopeOutline,
  IconLockOutline,
  IconPhoneOutline,
} from "../components/auth/AuthIcons";
import { api } from "../lib/api";
import { getDefaultRouteForRole } from "../lib/roleRoutes";

type Role = "owner" | "employee";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [allowOwnerSignup, setAllowOwnerSignup] = useState(false);
  const [loadingSignupOptions, setLoadingSignupOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const { signup } = useAuth();

  useEffect(() => {
    void (async () => {
      try {
        const status = await api.registrationStatus();
        setAllowOwnerSignup(status.allowOwnerSignup);
        setRole(status.allowOwnerSignup ? "owner" : "employee");
      } catch {
        setAllowOwnerSignup(false);
        setRole("employee");
      } finally {
        setLoadingSignupOptions(false);
      }
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !username || !password) {
      setError("กรุณากรอกชื่อ ชื่อผู้ใช้ และรหัสผ่านให้ครบ");
      return;
    }

    try {
      setSubmitting(true);
      const user = await signup({
        fullName: name,
        username,
        password,
        phone: phone || undefined,
        role: allowOwnerSignup && role === "owner" ? "OWNER" : "SALES",
      });
      navigate(getDefaultRouteForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = Boolean(error);
  const formBusy = submitting || loadingSignupOptions;

  return (
    <AuthHeroShell wide>
      <p className="auth-hero-brand">โต๊ะลพบุรี</p>
      <h1 className="auth-hero-page-title">สมัครสมาชิก</h1>
      <p className="auth-hero-page-desc">
        {allowOwnerSignup
          ? "สร้างบัญชีแรกของระบบ — สิทธิ์เจ้าของเปิดได้เฉพาะช่วงตั้งค่าเริ่มต้นเท่านั้น"
          : "สร้างบัญชีพนักงานเพื่อเข้าใช้งานระบบ"}
      </p>

      <form className="auth-hero-form auth-hero-form--compact" onSubmit={handleSubmit} noValidate>
        <div className={`auth-line-field${fieldError ? " auth-line-field--error" : ""}`}>
          <span className="auth-line-field__icon">
            <IconBadgeOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="signup-name">
            ชื่อ–นามสกุล
          </label>
          <input
            id="signup-name"
            className="auth-line-input"
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="FULL NAME"
            disabled={formBusy}
            aria-invalid={fieldError}
          />
        </div>

        <div className={`auth-line-field${fieldError ? " auth-line-field--error" : ""}`}>
          <span className="auth-line-field__icon">
            <IconEnvelopeOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="signup-username">
            ชื่อผู้ใช้
          </label>
          <input
            id="signup-username"
            className="auth-line-input"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="USERNAME"
            disabled={formBusy}
            aria-invalid={fieldError}
          />
        </div>

        <div className={`auth-line-field${fieldError ? " auth-line-field--error" : ""}`}>
          <span className="auth-line-field__icon">
            <IconLockOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="signup-password">
            รหัสผ่าน
          </label>
          <input
            id="signup-password"
            className="auth-line-input"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD"
            disabled={formBusy}
            aria-invalid={fieldError}
          />
        </div>

        <div className="auth-line-field">
          <span className="auth-line-field__icon">
            <IconPhoneOutline size={22} />
          </span>
          <label className="sr-only" htmlFor="signup-phone">
            เบอร์โทร (ไม่บังคับ)
          </label>
          <input
            id="signup-phone"
            className="auth-line-input"
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="PHONE (OPTIONAL)"
            disabled={formBusy}
          />
        </div>

        {allowOwnerSignup ? (
          <fieldset className="auth-role-fieldset">
            <legend className="auth-role-legend">บทบาท</legend>
            <div className="auth-role-row">
              <label className="auth-role-option">
                <input
                  type="radio"
                  name="role"
                  value="employee"
                  checked={role === "employee"}
                  onChange={() => setRole("employee")}
                  disabled={formBusy}
                />
                <span>พนักงาน</span>
              </label>
              <label className="auth-role-option">
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={role === "owner"}
                  onChange={() => setRole("owner")}
                  disabled={formBusy}
                />
                <span>เจ้าของ</span>
              </label>
            </div>
          </fieldset>
        ) : null}

        {error ? (
          <div className="auth-hero-alert" role="alert">
            {error}
          </div>
        ) : null}

        <button type="submit" className="auth-hero-submit" disabled={formBusy}>
          {loadingSignupOptions
            ? "กำลังโหลด…"
            : submitting
              ? "กำลังสร้างบัญชี…"
              : "สร้างบัญชี"}
        </button>
      </form>

      <p className="auth-hero-signup auth-hero-signup--tight">
        มีบัญชีแล้ว?{" "}
        <Link className="auth-hero-signup-link" to="/login">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthHeroShell>
  );
}
