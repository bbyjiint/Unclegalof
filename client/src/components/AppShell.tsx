import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import AuthSetup from "./AuthSetup";

const navItems = [
  { to: "/staff", label: "👤 พนักงาน" },
  { to: "/inventory", label: "📦 คลัง" },
  { to: "/repair", label: "🔧 ซ่อม/เคลม" },
  { to: "/owner", label: "🔐 เจ้าของ" }
];

export default function AppShell({ children }: PropsWithChildren) {
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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `vbtn${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
        <AuthSetup />
        {children}
      </div>
    </>
  );
}
