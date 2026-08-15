import type { Metadata } from "next";
import { RecRoomCloudPlayer } from "@/components/game/recroom-cloud-player";
import { RecRoomHostSetup } from "@/components/game/recroom-host-setup";

export const metadata: Metadata = {
  title: "Rec Room · Flux Games",
  description: "Launch the Flux Rec Room May 2022 compatibility project through an authenticated browser stream.",
};

export default function RecRoomPage() {
  return (
    <>
      <RecRoomCloudPlayer />
      <RecRoomHostSetup />
    </>
  );
}
