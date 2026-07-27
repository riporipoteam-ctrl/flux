import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { MobileBoot } from "@/components/providers/mobile-boot";
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
  title: "Flux by Ripo Team",
  description:
    "Flux is a premium social network by Ripo Team — posts, groups, chats, shop, Hangout multiplayer, and AskAI. Install as app on phone — Firebase-backed, no PC required.",
  applicationName: "Flux",
  authors: [{ name: "Ripo Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Flux",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=flux-20260722", type: "image/x-icon", sizes: "256x256" },
      { url: "/flux-icon.png?v=flux-20260722", type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: [{ url: "/flux-icon.png?v=flux-20260722", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/flux-icon.png?v=flux-20260722", type: "image/png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <MobileBoot />
            {children}
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                className: "border border-border shadow-soft",
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
