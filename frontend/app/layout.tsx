import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatCommit",
  description: "Git-like version control for ChatGPT sessions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-gray-100`}
      >
        {/* Header with bigger logo & burnt orange “ChatCommit” */}
        <header className="flex items-center p-4 border-b border-green-800">
          <div className="flex flex-col items-center mr-4">
            <Image
              src="/chatcommit-logo.webp"
              alt="ChatCommit Logo"
              width={100}
              height={100}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#ff6600" }}>
              ChatCommit
            </h1>
            <p className="text-xs mt-1 text-gray-400">
              © 2025 Tully EDM Vibe &nbsp;|&nbsp; info@tullyedmvibe.com
            </p>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
