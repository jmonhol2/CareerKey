type NavIconName =
  | "home"
  | "profile"
  | "matches"
  | "schedule"
  | "company"
  | "admin"
  | "logout"
  | "positions"
  | "appointments"
  | "back";

type NavIconProps = {
  name: NavIconName;
};

export default function NavIcon({ name }: NavIconProps) {
  const commonProps = {
    "aria-hidden": true,
    className: "navIcon",
    fill: "none",
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (name) {
    case "home":
      return (
        <svg {...commonProps}>
          <path d="m3.5 10.5 8.5-7 8.5 7" />
          <path d="M5.5 9.5V21h13V9.5M9.5 21v-7h5v7" />
        </svg>
      );
    case "profile":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21c.5-4.2 3-6.5 7.5-6.5s7 2.3 7.5 6.5" />
        </svg>
      );
    case "matches":
      return (
        <svg {...commonProps}>
          <path d="m4.5 12.5 5 5L20 7" />
        </svg>
      );
    case "schedule":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="M8 14h2M14 14h2M8 17.5h2M14 17.5h2" />
        </svg>
      );
    case "company":
      return (
        <svg {...commonProps}>
          <path d="M4 21V5a2 2 0 0 1 2-2h8v18M14 9h4a2 2 0 0 1 2 2v10M2 21h20" />
          <path d="M8 7h2M8 11h2M8 15h2M17 13h1M17 16h1" />
        </svg>
      );
    case "admin":
      return (
        <svg {...commonProps}>
          <path d="M12 3 4.5 6v5.3c0 4.7 3.1 8.4 7.5 9.7 4.4-1.3 7.5-5 7.5-9.7V6L12 3Z" />
          <path d="M9.2 12.1 11 14l4-4.2" />
        </svg>
      );
    case "logout":
      return (
        <svg {...commonProps}>
          <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" />
        </svg>
      );
    case "positions":
      return (
        <svg {...commonProps}>
          <rect x="3" y="6" width="18" height="14" rx="3" />
          <path d="M9 6V4h6v2M3 11h18M9.5 11v2h5v-2" />
        </svg>
      );
    case "appointments":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18M8 15l2.2 2.2L16 12.5" />
        </svg>
      );
    case "back":
      return (
        <svg {...commonProps}>
          <path d="m10 6-6 6 6 6M4 12h11a5 5 0 0 0 5-5" />
        </svg>
      );
  }
}
