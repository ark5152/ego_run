import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CrewProvider } from "@/components/crew";
import { THEME_BOOT } from "@/lib/theme-boot";

export const metadata: Metadata = {
  title: "EGO 러닝크루",
  description: "EGO 러닝크루 출석·일정·거리 인증·대회 기록",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "EGO", statusBarStyle: "default" },
  icons: { icon: "/favicon.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" />
      </head>
      <body>
        <CrewProvider>{children}</CrewProvider>
      </body>
    </html>
  );
}
