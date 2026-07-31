interface RTCOfferOptions {
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
}

/** Safari exposes playsInline on media elements at runtime, while some DOM typings omit it for audio. */
interface HTMLAudioElement {
  playsInline: boolean;
}
