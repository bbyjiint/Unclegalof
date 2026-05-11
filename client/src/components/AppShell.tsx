import type { PropsWithChildren } from "react";
import type { LucideIcon } from "lucide-react";
import { Armchair, ClipboardList, LogOut, Package, Shield, Truck, Wrench } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { canAccessRoute } from "../lib/roleRoutes";

const FULLSCREEN_AUTH_PATHS = new Set(["/", "/login", "/signup"]);

const navItems: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: "/staff", label: "รายการขาย", Icon: ClipboardList },
  { to: "/inventory", label: "คลัง", Icon: Package },
  { to: "/repair", label: "ซ่อม/เคลม", Icon: Wrench },
  { to: "/deliveries", label: "จัดส่ง", Icon: Truck },
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
            <Armchair size={20} strokeWidth={2} />
          </div>
          <div>
            <h1>โต๊ะลพบุรี</h1>
          </div>
        </div>
        {user ? (
          <button type="button" className="header-logout-btn" onClick={logout}>
            <LogOut size={15} strokeWidth={2} aria-hidden />
            ออกจากระบบ
          </button>
        ) : (
          <nav className="header-auth-nav">
            <NavLink to="/login" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
              เข้าสู่ระบบ
            </NavLink>
            <NavLink to="/signup" className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}>
              เปิดบัญชี
            </NavLink>
          </nav>
        )}
      </header>

      <div className="app-body">
        {children}
      </div>

      {user ? (
        <nav className="bottom-nav" aria-label="การนำทางหลัก">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to !== "/owner"}
              className={({ isActive }) => `bottom-nav__item${isActive ? " active" : ""}`}
            >
              <span className="bottom-nav__pill">
                <item.Icon size={20} strokeWidth={2} aria-hidden />
              </span>
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </>
  );
}
