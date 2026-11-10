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

export function SysFreight({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const cargo = `${uid}-cargo`;
  const cab = `${uid}-cab`;
  return (
    <svg
      className={`block h-[56px] w-[56px] shrink-0 drop-shadow-md ${className ?? ""}`}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Blue freight"
    >
      <rect x="6" y="16" width="30" height="22" rx="3" fill={`url(#${cargo})`} />
      <line x1="12" y1="20" x2="12" y2="34" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="20" x2="18" y2="34" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="20" x2="24" y2="34" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="20" x2="30" y2="34" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M34 22H42C44.2091 22 46.1264 23.4735 46.7082 25.6066L49.1082 34.4066C49.6806 36.5055 48.0931 38.5 45.922 38.5H34V22Z"
        fill={`url(#${cab})`}
      />
      <path d="M38 25H42.2C43.1 25 43.88 25.62 44.1 26.5L45.2 30.5H38V25Z" fill="#E0F2FE" />
      <rect x="10" y="38" width="36" height="3" fill="#64748B" />
      <circle cx="16" cy="41" r="5" fill="#334155" />
      <circle cx="16" cy="41" r="2.5" fill="#BAE6FD" />
      <circle cx="28" cy="41" r="5" fill="#334155" />
      <circle cx="28" cy="41" r="2.5" fill="#BAE6FD" />
      <circle cx="42" cy="41" r="5" fill="#334155" />
      <circle cx="42" cy="41" r="2.5" fill="#BAE6FD" />
      <line
        x1="6"
        y1="12"
        x2="22"
        y2="12"
        stroke="#38BDF8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 4"
      />
      <defs>
        <linearGradient id={cargo} x1="6" y1="16" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={cab} x1="34" y1="22" x2="49" y2="38.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SysSurcharge({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const paper = `${uid}-paper`;
  const badge = `${uid}-badge`;
  return (
    <svg
      className={`block h-[56px] w-[56px] shrink-0 drop-shadow-md ${className ?? ""}`}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Blue surcharge"
    >
      <path
        d="M12 10C12 7.79086 13.7909 6 16 6H40C42.2091 6 44 7.79086 44 10V48L40 45L36 48L32 45L28 48L24 45L20 48L16 45L12 48V10Z"
        fill={`url(#${paper})`}
      />
      <line x1="18" y1="14" x2="38" y2="14" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="18" y1="20" x2="30" y2="20" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="26" x2="26" y2="26" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="34" cy="34" r="12" fill="#E0F2FE" />
      <circle cx="34" cy="34" r="10" fill={`url(#${badge})`} />
      <path d="M34 27L40 33H36.5V40H31.5V33H28L34 27Z" fill="#F0F9FF" />
      <defs>
        <linearGradient id={paper} x1="12" y1="6" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id={badge} x1="24" y1="24" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SysStop({ className }: { className?: string }) {
  return (
    <svg
      className={`block h-[56px] w-[56px] shrink-0 drop-shadow ${className ?? ""}`}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Do not ship"
    >
      <path d="M18.5 6H37.5L50 18.5V37.5L37.5 50H18.5L6 37.5V18.5L18.5 6Z" fill="#DC2626" />
      <path
        d="M19.3 8.5H36.7L47.5 19.3V36.7L36.7 47.5H19.3L8.5 36.7V19.3L19.3 8.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        fill="none"
      />
      <text
        x="28"
        y="33"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="13"
        letterSpacing="1"
        textAnchor="middle"
      >
        STOP
      </text>
    </svg>
  );
}

export function SysDollar({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const base = `${uid}-base`;
  const top = `${uid}-top`;
  return (
    <SysImage className={className}>
      <rect x="6" y="6" width="44" height="44" rx="14" fill={`url(#${base})`} />
      <rect x="9" y="9" width="38" height="38" rx="11" fill={`url(#${top})`} fillOpacity="0.9" />
      <text
        x="28"
        y="38"
        fill="#78350F"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="28"
        textAnchor="middle"
      >
        $
      </text>
      <text
        x="28"
        y="36.5"
        fill="#FFFBEB"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="28"
        textAnchor="middle"
      >
        $
      </text>
      <defs>
        <linearGradient id={base} x1="6" y1="6" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={top} x1="9" y1="9" x2="47" y2="47" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
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
      <text
        x="28"
        y="36"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="16"
        textAnchor="middle"
      >
        Open
      </text>
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
      <text
        x="28"
        y="36"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="16"
        textAnchor="middle"
      >
        Open
      </text>
    </SysImage>
  );
}

export function SysApprove({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const base = `${uid}-approve-base`;
  const top = `${uid}-approve-top`;
  return (
    <svg
      className={`block h-14 w-[170px] shrink-0 drop-shadow-md ${className ?? ""}`}
      viewBox="0 0 170 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="6" y="6" width="158" height="44" rx="14" fill={`url(#${base})`} />
      <rect x="9" y="9" width="152" height="38" rx="11" fill={`url(#${top})`} fillOpacity="0.9" />
      <text
        x="24"
        y="33"
        fill="#78350F"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="16"
        letterSpacing="0.75"
      >
        APPROVE
      </text>
      <text
        x="24"
        y="31.5"
        fill="#FFFFFF"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="16"
        letterSpacing="0.75"
      >
        APPROVE
      </text>
      <circle cx="140" cy="28" r="14" fill="#78350F" opacity="0.2" />
      <path
        d="M132.5 28.5L137.5 33.5L147.5 22.5"
        stroke="#78350F"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M132.5 27L137.5 32L147.5 21"
        stroke="#FFFBEB"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={base} x1="6" y1="6" x2="164" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="1" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id={top} x1="9" y1="9" x2="161" y2="47" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SysApproved({ className }: { className?: string }) {
  return (
    <svg
      className={`block h-14 w-[170px] shrink-0 ${className ?? ""}`}
      viewBox="0 0 170 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="4" y="4" width="162" height="48" rx="12" fill="#FEF3C7" />
      <rect
        x="7"
        y="7"
        width="156"
        height="42"
        rx="9"
        stroke="#D97706"
        strokeWidth="2"
        strokeDasharray="4 2"
        fill="#FDE68A"
        fillOpacity="0.4"
      />
      <text
        x="24"
        y="33"
        fill="#B45309"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="16"
        letterSpacing="0.5"
      >
        Approved
      </text>
      <circle cx="138" cy="28" r="11" fill="#B45309" />
      <path
        d="M133 28L136.5 31.5L143 24.5"
        stroke="#FFFBEB"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SysRevoke({ className }: { className?: string }) {
  return (
    <svg
      className={`block h-14 w-[170px] shrink-0 ${className ?? ""}`}
      viewBox="0 0 170 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="4" y="4" width="162" height="48" rx="12" fill="#FEF3C7" />
      <rect
        x="7"
        y="7"
        width="156"
        height="42"
        rx="9"
        stroke="#D97706"
        strokeWidth="2"
        strokeDasharray="4 2"
        fill="#FDE68A"
        fillOpacity="0.4"
      />
      <text
        x="24"
        y="33"
        fill="#B45309"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="16"
        letterSpacing="0.5"
      >
        Revoke
      </text>
      <circle cx="138" cy="28" r="11" fill="#B45309" />
      <path
        d="M133 23L143 33M143 23L133 33"
        stroke="#FFFBEB"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SysCart({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const amber = `${uid}-cart`;
  return (
    <svg
      className={`block h-11 w-[134px] shrink-0 drop-shadow-[0_1px_2px_rgba(217,119,6,0.28)] ${className ?? ""}`}
      viewBox="0 0 170 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="4" y="4" width="162" height="48" rx="24" fill={`url(#${amber})`} />
      <rect
        x="4.5"
        y="4.5"
        width="161"
        height="47"
        rx="23.5"
        stroke="#FDE68A"
        strokeOpacity="0.6"
        strokeWidth="1"
      />
      <path
        d="M28 5H142C154.703 5 165 15.2975 165 28C165 17 154.703 8 142 8H28C15.2975 8 5 17 5 28C5 15.2975 15.2975 5 28 5Z"
        fill="#FFFFFF"
        fillOpacity="0.25"
      />
      <text
        x="28"
        y="33"
        fill="#FFFFFF"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
        fontWeight="600"
        fontSize="16"
        letterSpacing="-0.2"
      >
        Cart
      </text>
      <circle cx="138" cy="28" r="14" fill="#FFFFFF" fillOpacity="0.25" />
      <circle cx="138" cy="28" r="13.5" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1" />
      <path
        d="M129.5 22.5H132L134 30.5H142.5L144.5 24.5H133"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="135" cy="33.5" r="1.25" fill="#FFFFFF" />
      <circle cx="141.5" cy="33.5" r="1.25" fill="#FFFFFF" />
      <defs>
        <linearGradient id={amber} x1="4" y1="4" x2="166" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SysAddToCart({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const amber = `${uid}-add-to-cart`;
  return (
    <svg
      className={`block h-11 w-[134px] shrink-0 drop-shadow-[0_1px_2px_rgba(217,119,6,0.28)] ${className ?? ""}`}
      viewBox="0 0 170 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="4" y="4" width="162" height="48" rx="24" fill={`url(#${amber})`} />
      <rect
        x="4.5"
        y="4.5"
        width="161"
        height="47"
        rx="23.5"
        stroke="#FDE68A"
        strokeOpacity="0.6"
        strokeWidth="1"
      />
      <path
        d="M28 5H142C154.703 5 165 15.2975 165 28C165 17 154.703 8 142 8H28C15.2975 8 5 17 5 28C5 15.2975 15.2975 5 28 5Z"
        fill="#FFFFFF"
        fillOpacity="0.25"
      />
      <text
        x="24"
        y="33"
        fill="#FFFFFF"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif"
        fontWeight="600"
        fontSize="15"
        letterSpacing="-0.2"
      >
        Add to Cart
      </text>
      <circle cx="138" cy="28" r="14" fill="#FFFFFF" fillOpacity="0.25" />
      <circle cx="138" cy="28" r="13.5" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="1" />
      <path
        d="M129.5 22.5H132L134 30.5H142.5L144.5 24.5H133"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="135" cy="33.5" r="1.25" fill="#FFFFFF" />
      <circle cx="141.5" cy="33.5" r="1.25" fill="#FFFFFF" />
      <defs>
        <linearGradient id={amber} x1="4" y1="4" x2="166" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}
