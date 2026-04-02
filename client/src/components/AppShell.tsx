import type { PropsWithChildren } from "react";
import type { LucideIcon } from "lucide-react";
import { Armchair, ClipboardList, Package, Shield, Wrench } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { canAccessRoute } from "../lib/roleRoutes";

const FULLSCREEN_AUTH_PATHS = new Set(["/", "/login", "/signup"]);

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: "/staff", label: "รายการขาย", Icon: ClipboardList },
  { to: "/inventory", label: "คลัง", Icon: Package },
  { to: "/repair", label: "ซ่อม/เคลม", Icon: Wrench },
  { to: "/owner", label: "เจ้าของ", Icon: Shield },
];

export default function AppShell({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const visibleNavItems = navItems.filter(
    (item) => !user || canAccessRoute(user.role, item.to),
  );
  const fullscreenAuth = FULLSCREEN_AUTH_PATHS.has(pathname);

  if (fullscreenAuth) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="header">
        <div className="hlogo">
          <div className="ico" aria-hidden>
            <Armchair size={24} strokeWidth={2} />
          </div>
          <div>
            <h1>โต๊ะลพบุรี</h1>
          </div>
        </div>
        <nav className="vtoggle">
          {user ? (
            <>
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to !== "/owner"}
                  className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}
                >
                  <span className="nav-link-inner">
                    <item.Icon size={18} strokeWidth={2} />
                    {item.label}
                  </span>
                </NavLink>
              ))}
              <button type="button" className="vbtn vbtn-signout" onClick={logout}>
                ออกจากระบบ
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
                เข้าสู่ระบบ
              </NavLink>
              <NavLink to="/signup" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
                เปิดบัญชี
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
