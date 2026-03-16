import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./AuthProvider";

const navItems = [
  { to: "/staff", label: "👤 พนักงาน" },
  { to: "/inventory", label: "📦 คลัง" },
  { to: "/repair", label: "🔧 ซ่อม/เคลม" },
  { to: "/owner", label: "🔐 เจ้าของ" }
];

export default function AppShell({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();
  const visibleNavItems = navItems.filter((item) => item.to !== "/owner" || user?.role === "OWNER" || user?.role === "ADMIN");

  return (
    <>
      <header className="header">
        <div className="hlogo">
          <div className="ico">🪑</div>
          <div>
            <h1>โต๊ะลพบุรี</h1>
            <p>React + TypeScript + Express + Prisma</p>
          </div>
        </div>
        <nav className="vtoggle">
          {user ? (
            <>
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
              <button type="button" className="vbtn" onClick={logout}>
                ออกจากระบบ
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
                เข้าสู่ระบบ
              </NavLink>
              <NavLink to="/signup" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
                สมัครสมาชิก
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
        {children}
      </div>
    </>
  );
}
