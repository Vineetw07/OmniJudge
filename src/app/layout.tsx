import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "DOGFOOD 2026",
  description: "Hackathon submission and judging platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground flex flex-col relative`}
      >
        {/* Ambient Top Cyan/Indigo Glow */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none -z-10 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56, 189, 248, 0.12), transparent)",
          }}
        />

        {/* Global Floating Glass Navbar */}
        <Navbar />

        {/* Page Entrance Animated Container */}
        <PageTransition>
          {children}
        </PageTransition>
      </body>
    </html>
  );
}
