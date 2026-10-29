import { useId } from "react";

function SysImage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      className={`block h-7 w-7 shrink-0 drop-shadow ${className ?? ""}`}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SysPrint({ className }: { className?: string }) {
  return (
    <SysImage className={className}>
      <path
        d="M18 10H38C39.1046 10 40 10.8954 40 12V20H16V12C16 10.8954 16.8954 10 18 10Z"
        fill="#FEF3C7"
      />
      <rect x="8" y="18" width="40" height="20" rx="4" fill="#D97706" />
      <path
        d="M8 26C8 26 12 28 28 28C44 28 48 26 48 26V34C48 36.2091 46.2091 38 44 38H12C9.79086 38 8 36.2091 8 34V26Z"
        fill="#F59E0B"
      />
      <path
        d="M18 28H38V42C38 43.1046 37.1046 44 36 44H20C18.8954 44 18 43.1046 18 42V28Z"
        fill="#FFFBEB"
      />
      <line
        x1="22"
        y1="33"
        x2="34"
        y2="33"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="37"
        x2="30"
        y2="37"
        stroke="#FBBF24"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </SysImage>
  );
}

export function SysSend({ className }: { className?: string }) {
  return (
    <SysImage className={className}>
      <path d="M48 8L6 26L22 33L48 8Z" fill="#D97706" />
      <path d="M22 33L28 47L34 37L22 33Z" fill="#B45309" />
      <path d="M48 8L22 33L34 37L48 8Z" fill="#F59E0B" />
    </SysImage>
  );
}

export function SysPost({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const top = `${uid}-top`;
  const mid = `${uid}-mid`;
  const base = `${uid}-base`;
  return (
    <SysImage className={className}>
      <path
        d="M10 14C10 10.6863 18.0589 8 28 8C37.9411 8 46 10.6863 46 14C46 17.3137 37.9411 20 28 20C18.0589 20 10 17.3137 10 14Z"
        fill={`url(#${top})`}
      />
      <path
        d="M10 14V24C10 27.3137 18.0589 30 28 30C37.9411 30 46 27.3137 46 24V14C46 17.3137 37.9411 20 28 20C18.0589 20 10 17.3137 10 14Z"
        fill={`url(#${mid})`}
      />
      <path
        d="M10 24V34C10 37.3137 18.0589 40 28 40C37.9411 40 46 37.3137 46 34V24C46 27.3137 37.9411 30 28 30C18.0589 30 10 27.3137 10 24Z"
        fill={`url(#${base})`}
      />
      <circle cx="38" cy="38" r="11" fill="#78350F" />
      <path d="M38 31L31 38H35V45H41V38H45L38 31Z" fill="#FEF3C7" />
      <defs>
        <linearGradient id={top} x1="10" y1="8" x2="46" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={mid} x1="10" y1="14" x2="46" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id={base} x1="10" y1="24" x2="46" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
      </defs>
    </SysImage>
  );
}

export function SysFolder({ className }: { className?: string }) {
  return (
    <SysImage className={className}>
      <path
        d="M7 15C7 12.7909 8.79086 11 11 11H21C22.0609 11 23.0783 11.4214 23.8284 12.1716L27.6569 16H45C47.2091 16 49 17.7909 49 20V22H7V15Z"
        fill="#D97706"
      />
      <path
        d="M7 20C7 17.7909 8.79086 16 11 16H45C47.2091 16 49 17.7909 49 20V41C49 43.2091 47.2091 45 45 45H11C8.79086 45 7 43.2091 7 41V20Z"
        fill="#F59E0B"
      />
    </SysImage>
  );
}

export function SysFolderOpen({ className }: { className?: string }) {
  return (
    <SysImage className={className}>
      <path
        d="M7 15C7 12.7909 8.79086 11 11 11H21C22.0609 11 23.0783 11.4214 23.8284 12.1716L27.6569 16H45C47.2091 16 49 17.7909 49 20V41C49 43.2091 47.2091 45 45 45H11C8.79086 45 7 43.2091 7 41V15Z"
        fill="#D97706"
      />
      <path
        d="M7 21C7 18.7909 8.79086 17 11 17H45C47.2091 17 49 18.7909 49 21V41C49 43.2091 47.2091 45 45 45H11C8.79086 45 7 43.2091 7 41V21Z"
        fill="#F59E0B"
      />
    </SysImage>
  );
}
