import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Flux mobile app (APK / IPA shell).
 *
 * Backend = Firebase Auth + Firestore + Storage (cloud) — no Windows PC required.
 * The 2019 Windows Rec Room EXE is NOT inside this package (impossible on iOS/Android).
 * This app IS full Flux: social + Hangout multiplayer + shop/profile when signed in.
 *
 * server.url:
 *  - Dev: http://YOUR_LAN_IP:3000  (phone + PC same Wi‑Fi, npm run dev)
 *  - Prod: https://your-flux.web.app or Netlify URL after deploy
 * Override: set CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "network.flux.social",
  appName: "Flux",
  webDir: "public",
  server: {
    // Live-load the Flux web app (Firebase-backed). Works install → open → play.
    url: serverUrl,
    cleartext: true, // allow http:// for local LAN dev
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0a0a0c",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0c",
    },
    Keyboard: {
      resize: "body",
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
