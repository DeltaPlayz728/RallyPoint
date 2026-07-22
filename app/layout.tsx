import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import BottomNavWrapper from "@/components/BottomNavWrapper";
import SubscriptionCelebrationWrapper from "@/components/SubscriptionCelebrationWrapper";
import FeedbackButton from "@/components/FeedbackButton";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/components/ThemeProvider";
import ErrorLogger from "@/components/ErrorLogger";
import ReferralCapture from "@/components/ReferralCapture";
import CriticalPatchBanner from "@/components/CriticalPatchBanner";
import SoundCueListener from "@/components/SoundCueListener";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headings, event titles, and the wordmark — Fraunces'
// "soft"/optical-size character pairs with the hand-felt sticker logo
// instead of leaving every heading in the same UI-chrome sans as buttons
// and labels. This is the single highest-leverage typography change for
// making the app read as designed rather than scaffolded.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  weight: "variable",
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RallyPoint — Real places. Real people. No swiping required.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RallyPoint — Stop scrolling. Start showing up.",
    description: "Find casual meetups and real-life events near you.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

// viewportFit: 'cover' lets safe-area-inset-* env() vars resolve on notch/home-indicator
// devices, and pairs with the h-dvh switch below to keep the fixed BottomNav from being
// pushed off-screen when mobile Safari's dynamic toolbar is expanded.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint so dark mode doesn't flash light first */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <CriticalPatchBanner />
          {children}
          <BottomNavWrapper />
          <SubscriptionCelebrationWrapper />
          <FeedbackButton />
          <ErrorLogger />
          <ReferralCapture />
          <SoundCueListener />
        </ThemeProvider>
      </body>
    </html>
  );
}
