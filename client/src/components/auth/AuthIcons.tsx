type IconProps = {
  className?: string;
  size?: number;
};

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconUserOutline({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle {...stroke} cx="12" cy="8" r="3.75" />
      <path {...stroke} d="M5.5 21v-0.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5V21" />
    </svg>
  );
}

export function IconLockOutline({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path {...stroke} d="M7 11V8a5 5 0 0 1 10 0v3" />
      <rect {...stroke} x="5" y="11" width="14" height="11" rx="1.5" />
    </svg>
  );
}

export function IconEnvelopeOutline({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect {...stroke} x="3" y="5" width="18" height="14" rx="2" />
      <path {...stroke} d="M3 8l9 5.5L21 8" />
    </svg>
  );
}

export function IconPhoneOutline({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect {...stroke} x="7" y="3" width="10" height="18" rx="2" />
      <path {...stroke} d="M10 19h4" />
    </svg>
  );
}

export function IconBadgeOutline({ className, size = 22 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect {...stroke} x="4" y="5" width="16" height="14" rx="2" />
      <circle {...stroke} cx="12" cy="11" r="2.25" />
      <path {...stroke} d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    </svg>
  );
}
