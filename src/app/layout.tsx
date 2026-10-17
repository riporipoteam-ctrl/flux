import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { MobileBoot } from "@/components/providers/mobile-boot";
import { RouteMotion } from "@/components/providers/route-motion";
import "./globals.css";
import "@/styles/editor-surfaces.css";
import "@/styles/flux-engine.css";
import "@/styles/flux-v11.css";
import "@/styles/askai-v11.css";
import "@/styles/flux-v11-deep.css";
import "@/styles/flux-v11-posts.css";
import "@/styles/askai-v11-deep.css";
import "@/styles/flux-v11-visible.css";
import "@/styles/flux-v12-rebuild.css";
import "@/styles/flux-v13-redesign.css";
import "@/styles/flux-motion.css";
import "@/styles/flux-x.css";
import "@/styles/askai-grok.css";
import "@/styles/flux-platform.css";
import "@/styles/flux-social-navigation.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const release = process.env.NEXT_PUBLIC_RELEASE_SHA || "local";

export const metadata: Metadata = {
  title: "Flux — Social, Create, Flux Rec",
  description:
    "Flux is the social network by Ripo Team — connect, create, share, and explore Flux Rec rooms and photos from mobile, tablet or PC.",
  applicationName: "Flux",
  authors: [{ name: "Ripo Team" }],
  manifest: `${basePath}/manifest.webmanifest?v=flux-identity-2026`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Flux" },
  icons: {
    icon: [
      {
        url: `${basePath}/favicon.ico?v=flux-identity-2026`,
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48 64x64",
      },
      {
        url: `${basePath}/icons/flux-192.png?v=flux-identity-2026`,
        type: "image/png",
        sizes: "192x192",
      },
    ],
    shortcut: [
      {
        url: `${basePath}/icons/flux-192.png?v=flux-identity-2026`,
        type: "image/png",
        sizes: "192x192",
      },
    ],
    apple: [
      {
        url: `${basePath}/apple-touch-icon.png?v=flux-identity-2026`,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "flux-release": release,
    "flux-ui": "identity-2026",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101714" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="light"
      data-accent="blue"
      data-flux-ui="x5"
      data-flux-release={release.slice(0, 12)}
      suppressHydrationWarning
    >
      <head>
        <meta name="flux-compat-ui" content="x5" data-flux-ui="x5" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("flux-theme-v2");var a=localStorage.getItem("flux-accent-v1");var r=document.documentElement;if(!t){t="light";try{localStorage.setItem("flux-theme-v2","light")}catch(e){}}if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="light"||t==="dim"||t==="dark"){r.classList.remove("light","dim","dark");r.classList.add(t);r.style.colorScheme=t==="light"?"light":"dark"}if(a){r.dataset.accent=a}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>
            <MobileBoot />
            <RouteMotion>{children}</RouteMotion>
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
