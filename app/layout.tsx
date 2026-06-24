import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNavWrapper from "@/components/BottomNavWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rally-point-eb1q.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "RallyPoint — Stop scrolling. Start showing up.",
    template: "%s · RallyPoint",
  },
  description:
    "RallyPoint connects people 18–30 through real-life events — casual meetups, bowling nights, and everything in between. Free to join.",
  openGraph: {
    title: "RallyPoint — Stop scrolling. Start showing up.",
    description:
      "Find casual meetups and real-life events near you. Free to join, no app download needed.",
    url: appUrl,
    siteName: "RallyPoint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RallyPoint — Stop scrolling. Start showing up.",
    description: "Find casual meetups and real-life events near you.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNavWrapper />
      </body>
    </html>
  );
}
