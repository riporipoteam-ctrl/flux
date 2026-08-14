import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { MobileBoot } from "@/components/providers/mobile-boot";
import { RouteMotion } from "@/components/providers/route-motion";
import "./globals.css";
import "@/styles/editor-surfaces.css";
import "@/styles/flux-engine.css";
import "@/styles/askai-workspace.css";
import "@/styles/askai-workspace-v2.css";
import "@/styles/flux-v8.css";
import "@/styles/flux-v8-tokens.css";
import "@/styles/flux-polish.css";
import "@/styles/flux-x-ultimate.css";
import "@/styles/flux-mobile-dock.css";
import "@/styles/flux-performance-x4.css";
import "@/styles/flux-v10.css";
import "@/styles/askai-v10.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const release = process.env.NEXT_PUBLIC_RELEASE_SHA || "local";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flux — Social, Games, Create",
  description: "Flux is the social and gaming network by Ripo Team — connect, create, share and play free browser games from mobile, tablet or PC.",
  applicationName: "Flux",
  authors: [{ name: "Ripo Team" }],
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Flux" },
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico?v=flux-v10`, type: "image/x-icon", sizes: "256x256" },
      { url: `${basePath}/flux-icon.png?v=flux-v10`, type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: [{ url: `${basePath}/flux-icon.png?v=flux-v10`, type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: `${basePath}/flux-icon.png?v=flux-v10`, type: "image/png", sizes: "180x180" }],
  },
  other: { "mobile-web-app-capable": "yes", "flux-release": release, "flux-ui": "v10" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="light" data-accent="blue" data-flux-ui="v10" data-flux-release={release.slice(0, 12)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("flux-theme-v2");var a=localStorage.getItem("flux-accent-v1");var r=document.documentElement;if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="light"||t==="dim"||t==="dark"){r.classList.remove("light","dim","dark");r.classList.add(t);r.style.colorScheme=t==="light"?"light":"dark"}if(a){r.dataset.accent=a}}catch(e){}})()` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <MobileBoot />
            <RouteMotion>{children}</RouteMotion>
            <Toaster position="top-center" richColors closeButton toastOptions={{ className: "border border-border shadow-soft" }} />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
