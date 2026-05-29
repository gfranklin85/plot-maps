import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import ClientProviders from "@/components/layout/ClientProviders";
import AppShell from "@/components/layout/AppShell";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-context";

export const metadata: Metadata = {
  title: "Plot Maps | Circle Prospecting Tool",
  description: "See the listing. Call the neighbors. Circle prospect with full context from the map.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Plot Maps",
  },
};

export const viewport: Viewport = {
  themeColor: "#F4EAD5",
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
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        {/* Theme bootstrap — runs BEFORE React hydration to set
            data-theme on <html> from localStorage / prefers-color-scheme.
            Prevents flash-of-wrong-theme on the public pages. The
            ThemeProvider below reads what this script painted. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-surface text-on-surface">
        <ThemeProvider>
          <ClientProviders>
            <AppShell>
              {children}
            </AppShell>
          </ClientProviders>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
