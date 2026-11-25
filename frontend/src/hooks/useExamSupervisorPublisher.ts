import { useEffect, useRef, useState } from "react";
import {
    ICE_SERVERS,
    connectSignaling,
    preferVp8,
} from "@/lib/exam-supervisor-rtc";

export type PublisherStatus =
    | "off"
    | "connecting"
    | "waiting"
    | "live"
    | "error";

export function useExamSupervisorPublisher(
    attemptId: number | undefined,
    enabled: boolean,
    cameraStream: MediaStream | null,
    screenStream: MediaStream | null,
): PublisherStatus {
    const [status, setStatus] = useState<PublisherStatus>("off");

    const screenSenderRef = useRef<RTCRtpSender | null>(null);
    const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
    const screenTrackRef = useRef<MediaStreamTrack | null>(null);

    cameraTrackRef.current = cameraStream?.getVideoTracks()[0] ?? null;
    screenTrackRef.current = screenStream?.getVideoTracks()[0] ?? null;

    useEffect(() => {
        if (!enabled || !attemptId || !cameraStream) {
            setStatus("off");
            return;
        }

        let pc: RTCPeerConnection | null = null;
        let pendingIce: RTCIceCandidateInit[] = [];
        let disconnectTimer: number | undefined;

        const closePeer = () => {
            window.clearTimeout(disconnectTimer);
            pc?.close();
            pc = null;
            pendingIce = [];
            screenSenderRef.current = null;
        };

        const signaling = connectSignaling({
            attemptId,
            role: "STUDENT",

            onState: (state) => {
                if (state === "open") setStatus("waiting");
                else if (state === "connecting") setStatus("connecting");
                else if (state === "denied") setStatus("error");
                else {
                    closePeer();
                    setStatus("off");
                }
            },

            onMessage: async (message) => {
                if (message.type === "request-offer") {
                    closePeer();

                    const peer = new RTCPeerConnection({
                        iceServers: ICE_SERVERS,
                    });
                    pc = peer;

                    // m-line 0: webcam, m-line 1: màn hình (giữ chỗ).
                    const cameraTx = peer.addTransceiver("video", {
                        direction: "sendonly",
                    });
                    const screenTx = peer.addTransceiver("video", {
                        direction: "sendonly",
                    });

                    preferVp8(cameraTx);
                    preferVp8(screenTx);

                    screenSenderRef.current = screenTx.sender;

                    await cameraTx.sender.replaceTrack(cameraTrackRef.current);
                    await screenTx.sender.replaceTrack(screenTrackRef.current);

                    peer.onicecandidate = ({ candidate }) => {
                        if (candidate) {
                            signaling.send({
                                type: "ice",
                                payload: candidate.toJSON(),
                            });
                        }
                    };

                    peer.onconnectionstatechange = () => {
                        if (pc !== peer) return;

                        window.clearTimeout(disconnectTimer);

                        if (peer.connectionState === "connected") {
                            setStatus("live");
                        } else if (peer.connectionState === "disconnected") {
                            // Mất mạng thoáng qua: đợi 5s rồi mới dựng lại.
                            disconnectTimer = window.setTimeout(
                                () => signaling.restart(),
                                5000,
                            );
                        } else if (peer.connectionState === "failed") {
                            setStatus("waiting");
                            signaling.restart();
                        }
                    };

                    const offer = await peer.createOffer();
                    await peer.setLocalDescription(offer);

                    signaling.send({
                        type: "offer",
                        payload: peer.localDescription ?? offer,
                    });
                } else if (
                    message.type === "answer" &&
                    pc &&
                    message.payload
                ) {
                    await pc.setRemoteDescription(
                        message.payload as RTCSessionDescriptionInit,
                    );

                    for (const candidate of pendingIce.splice(0)) {
                        await pc
                            .addIceCandidate(candidate)
                            .catch(() => undefined);
                    }
                } else if (message.type === "ice" && message.payload) {
                    const candidate = message.payload as RTCIceCandidateInit;

                    if (pc?.remoteDescription) {
                        await pc.addIceCandidate(candidate).catch(() => undefined);
                    } else {
                        pendingIce.push(candidate);
                    }
                } else if (message.type === "peer-left") {
                    closePeer();
                    setStatus("waiting");
                }
            },
        });

        return () => {
            signaling.close();
            closePeer();
        };
    }, [attemptId, enabled, cameraStream]);

    // Bật/tắt chia sẻ màn hình không cần dựng lại WebRTC.
    useEffect(() => {
        void screenSenderRef.current
            ?.replaceTrack(screenTrackRef.current)
            .catch(() => undefined);
    }, [screenStream]);

    return status;
}