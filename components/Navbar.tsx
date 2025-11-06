"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButtons from "./AuthButtons";

const navItems = [
  { name: "Home", href: "/" },
  { name: "Roadmap", href: "/roadmap" },
  { name: "Practice", href: "/practice" },
  { name: "Notes", href: "/notes" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 w-full bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="text-2xl font-extrabold text-blue-600 tracking-tight">
          CareerForge
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex gap-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`text-sm font-medium transition ${
                pathname === item.href
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-700 hover:text-blue-600"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Auth Section */}
        <AuthButtons />
      </div>
    </nav>
  );
}
