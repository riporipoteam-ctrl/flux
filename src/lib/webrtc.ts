export type LiveSourceMode = "camera" | "screen";

export interface MediaDeviceChoice {
  audioInputId?: string;
  videoInputId?: string;
}

export interface CaptureOptions extends MediaDeviceChoice {
  source: LiveSourceMode;
  microphone: boolean;
  camera: boolean;
  systemAudio: boolean;
}

export interface CapturedMedia {
  stream: MediaStream;
  cleanup: () => void;
  hasMicrophone: boolean;
  hasSystemAudio: boolean;
  source: LiveSourceMode;
}

export function getFluxIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME?.trim() || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim() || undefined,
    });
  }

  return servers;
}

export function supportsScreenShare(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export function mediaCaptureReady(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function describeMediaError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Flux could not open your camera or microphone.";
  }

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return "Camera, microphone, or screen permission was blocked. Allow it in browser settings and make sure Flux is opened over HTTPS.";
  }
  if (error.name === "NotFoundError") {
    return "Flux could not find the selected camera or microphone.";
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return "Another app or browser tab may already be using this camera or microphone.";
  }
  if (error.name === "OverconstrainedError") {
    return "The selected device cannot provide the requested quality. Choose another device.";
  }
  if (error.name === "AbortError") {
    return "Media capture was cancelled before it started.";
  }

  return error.message || "Flux could not start media capture.";
}

export async function listMediaDevices(): Promise<{
  microphones: MediaDeviceInfo[];
  cameras: MediaDeviceInfo[];
}> {
  if (!navigator.mediaDevices?.enumerateDevices) return { microphones: [], cameras: [] };
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    microphones: devices.filter((device) => device.kind === "audioinput"),
    cameras: devices.filter((device) => device.kind === "videoinput"),
  };
}

export async function captureFluxMedia(options: CaptureOptions): Promise<CapturedMedia> {
  if (!mediaCaptureReady()) {
    throw new Error("Camera and microphone require a secure HTTPS page or the installed Flux app.");
  }

  return options.source === "screen"
    ? captureScreen(options)
    : captureCamera(options);
}

async function captureCamera(options: CaptureOptions): Promise<CapturedMedia> {
  if (!options.camera && !options.microphone) {
    throw new Error("Turn on a camera or microphone before starting a live.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: options.camera
      ? {
          deviceId: options.videoInputId ? { exact: options.videoInputId } : undefined,
          facingMode: options.videoInputId ? undefined : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        }
      : false,
    audio: options.microphone
      ? {
          deviceId: options.audioInputId ? { exact: options.audioInputId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stream,
    source: "camera",
    hasMicrophone: stream.getAudioTracks().length > 0,
    hasSystemAudio: false,
    cleanup,
  };
}

async function captureScreen(options: CaptureOptions): Promise<CapturedMedia> {
  if (!supportsScreenShare()) {
    throw new Error("Screen sharing is not supported by this browser. It works best in desktop Chrome, Edge, and Safari.");
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 } },
    audio: options.systemAudio,
  });

  let microphoneStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;

  try {
    if (options.microphone) {
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          deviceId: options.audioInputId ? { exact: options.audioInputId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }

    const displayAudio = displayStream.getAudioTracks();
    const microphoneAudio = microphoneStream?.getAudioTracks() || [];
    let outputAudioTracks: MediaStreamTrack[] = [];

    if (displayAudio.length && microphoneAudio.length) {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        const destination = audioContext.createMediaStreamDestination();
        const displayGain = audioContext.createGain();
        const microphoneGain = audioContext.createGain();
        displayGain.gain.value = 0.9;
        microphoneGain.gain.value = 1;
        audioContext
          .createMediaStreamSource(new MediaStream(displayAudio))
          .connect(displayGain)
          .connect(destination);
        audioContext
          .createMediaStreamSource(new MediaStream(microphoneAudio))
          .connect(microphoneGain)
          .connect(destination);
        await audioContext.resume();
        outputAudioTracks = destination.stream.getAudioTracks();
      }
    }

    if (!outputAudioTracks.length) {
      outputAudioTracks = displayAudio.length ? displayAudio : microphoneAudio;
    }

    const stream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...outputAudioTracks,
    ]);

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      displayStream.getTracks().forEach((track) => track.stop());
      microphoneStream?.getTracks().forEach((track) => track.stop());
      stream.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") void audioContext.close();
    };

    displayStream.getVideoTracks()[0]?.addEventListener("ended", cleanup, { once: true });

    return {
      stream,
      source: "screen",
      hasMicrophone: microphoneAudio.length > 0,
      hasSystemAudio: displayAudio.length > 0,
      cleanup,
    };
  } catch (error) {
    displayStream.getTracks().forEach((track) => track.stop());
    microphoneStream?.getTracks().forEach((track) => track.stop());
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
    throw error;
  }
}
