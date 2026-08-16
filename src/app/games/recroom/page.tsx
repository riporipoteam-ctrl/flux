import type { Metadata } from "next";
import { RecRoomCloudPlayer } from "@/components/game/recroom-cloud-player";

export const metadata: Metadata = {
  title: "Rec Room · Flux Games",
  description: "Launch the May 19, 2022 Rec Room client in an on-demand RipoTeamServer Windows VM and stream it into Flux.",
};

export default function RecRoomPage() {
  return <RecRoomCloudPlayer />;
}
