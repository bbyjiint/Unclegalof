import type { PropsWithChildren } from "react";

type AuthHeroShellProps = PropsWithChildren<{
  wide?: boolean;
}>;

export function AuthHeroShell({ wide, children }: AuthHeroShellProps) {
  return (
    <main className="auth-hero">
      <div className="auth-hero-decor" aria-hidden>
        <svg
          className="auth-hero-waves"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            fill="rgba(0, 0, 0, 0.14)"
            d="M0,420 C280,320 420,520 720,440 C920,390 1020,280 1200,360 L1200,800 L0,800 Z"
          />
          <path
            fill="rgba(0, 0, 0, 0.1)"
            d="M0,520 C200,400 500,620 800,500 C950,450 1100,380 1200,420 L1200,800 L0,800 Z"
          />
          <path
            fill="rgba(45, 122, 79, 0.12)"
            d="M0,180 C320,280 480,80 780,200 C980,280 1080,120 1200,200 L1200,0 L0,0 Z"
          />
        </svg>
      </div>

      <div
        className={wide ? "auth-hero-inner auth-hero-inner--wide" : "auth-hero-inner"}
      >
        {children}
      </div>
    </main>
  );
}
