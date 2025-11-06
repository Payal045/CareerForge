"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="w-20 h-6 bg-gray-200 rounded animate-pulse"></div>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline text-sm text-gray-700 font-medium">
          👋 {session.user?.name || "User"}
        </span>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => signIn("google")}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
      >
        Google
      </button>
      <button
        onClick={() => signIn("github")}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-900 transition"
      >
        GitHub
      </button>
      <button
        onClick={() => signIn("credentials", { redirect: false, name: "Guest" })}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition"
      >
        Guest
      </button>
    </div>
  );
}
