import type { CapacitorConfig } from "@capacitor/cli";

const developmentServer = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "network.flux.social",
  appName: "Flux",
  webDir: "out",
  ...(developmentServer
    ? {
        server: {
          url: developmentServer,
          cleartext: developmentServer.startsWith("http://"),
          androidScheme: "https",
        },
      }
    : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: "#ffffff",
    },
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#ffffff",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
