import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNavWrapper from "@/components/BottomNavWrapper";
import SubscriptionCelebrationWrapper from "@/components/SubscriptionCelebrationWrapper";
import FeedbackButton from "@/components/FeedbackButton";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/components/ThemeProvider";
import ErrorLogger from "@/components/ErrorLogger";
import ReferralCapture from "@/components/ReferralCapture";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint so dark mode doesn't flash light first */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <BottomNavWrapper />
          <SubscriptionCelebrationWrapper />
          <FeedbackButton />
          <ErrorLogger />
          <ReferralCapture />
        </ThemeProvider>
      </body>
    </html>
  );
}
