/**
 * @fileoverview Root layout component for the Next.js application.
 * @module app/layout
 *
 * @description
 * Defines the root HTML structure, fonts, metadata, and providers
 * for the entire application.
 *
 * @pattern Provider Pattern - Wraps app with SessionProvider context
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
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
  title: "One Night Ultimate Werewolf",
  description: "Play One Night Ultimate Werewolf online with friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0f0f1a] min-h-screen`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
