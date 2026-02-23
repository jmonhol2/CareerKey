"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/auth", label: "Auth" },
  { href: "/home", label: "Home" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <div className="nav">
      <div className="brand">
        <span>CareerKey</span>
        <span className="badge">Prototype</span>
      </div>

      <div className="navlinks">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`navlink ${active ? "navlinkActive" : ""}`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
