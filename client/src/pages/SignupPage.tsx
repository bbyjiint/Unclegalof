import { Link } from "react-router-dom";
import { AuthHeroShell } from "../components/auth/AuthHeroShell";

/**
 * Public self-registration is disabled. Owners are provisioned manually; staff are created by the owner after login.
 */
export default function SignupPage() {
  return (
    <AuthHeroShell wide>
      <p className="auth-hero-brand">โต๊ะลพบุรี</p>
      <h1 className="auth-hero-page-title">การเปิดบัญชี</h1>
      <p className="auth-hero-page-desc">
        ระบบไม่รับสมัครสมาชิกแบบสาธารณะ บัญชีเจ้าของสร้างโดยผู้ดูแลระบบ และบัญชีพนักงานสร้างได้จากหน้า{" "}
        <strong>เจ้าของ</strong> หลังเข้าสู่ระบบด้วยบัญชีเจ้าของ
      </p>
      <p className="auth-hero-signup auth-hero-signup--tight">
        <Link className="auth-hero-signup-link" to="/login">
          กลับไปเข้าสู่ระบบ
        </Link>
      </p>
    </AuthHeroShell>
  );
}
