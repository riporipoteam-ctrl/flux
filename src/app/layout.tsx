import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { MobileBoot } from "@/components/providers/mobile-boot";
import "./globals.css";
import "./social-effects.css";
import "./polish.css";
import "./social-rebuild.css";
import "@/styles/editor-surfaces.css";
import "@/styles/flux-v5.css";
import "@/styles/flux-engine.css";
import "@/styles/flux-social-2027.css";
import "@/styles/askai-workspace.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flux — Social, Games, Create",
  description:
    "Flux is the social and gaming network by Ripo Team — connect, create, share and play free browser games from mobile, tablet or PC.",
  applicationName: "Flux",
  authors: [{ name: "Ripo Team" }],
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flux",
  },
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico?v=flux-20260801`, type: "image/x-icon", sizes: "256x256" },
      { url: `${basePath}/flux-icon.png?v=flux-20260801`, type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: [{ url: `${basePath}/flux-icon.png?v=flux-20260801`, type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: `${basePath}/flux-icon.png?v=flux-20260801`, type: "image/png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
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
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <MobileBoot />
            {children}
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{ className: "border border-border shadow-soft" }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
