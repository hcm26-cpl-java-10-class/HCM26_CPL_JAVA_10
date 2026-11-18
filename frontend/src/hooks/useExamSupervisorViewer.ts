import { useEffect, useRef, useState } from "react";
import { ICE_SERVERS, connectSignaling } from "@/lib/exam-supervisor-rtc";

export type ViewerStatus = "connecting" | "waiting" | "live" | "error";

export interface ExamSupervisorMedia {
    camera: MediaStream | null;
    screen: MediaStream | null;
}

export function useExamSupervisorViewer(attemptId: number) {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState<ViewerStatus>("connecting");

    useEffect(() => {
        let pc: RTCPeerConnection | null = null;
        let pendingIce: RTCIceCandidateInit[] = [];
        let disconnectTimer: number | undefined;

        const closePeer = () => {
            window.clearTimeout(disconnectTimer);
            pc?.close();
            pc = null;
            pendingIce = [];
            setCameraStream(null);
            setScreenStream(null);
        };

        const signaling = connectSignaling({
            attemptId,
            role: "SUPERVISOR",

            onState: (state) => {
                if (state === "open") setStatus("waiting");
                else if (state === "connecting") setStatus("connecting");
                else if (state === "denied") setStatus("error");
                else {
                    closePeer();
                    setStatus("waiting");
                }
            },

            onMessage: async (message) => {
                if (message.type === "offer" && message.payload) {
                    closePeer();

                    const peer = new RTCPeerConnection({
                        iceServers: ICE_SERVERS,
                    });
                    pc = peer;

                    peer.onicecandidate = ({ candidate }) => {
                        if (candidate) {
                            signaling.send({
                                type: "ice",
                                payload: candidate.toJSON(),
                            });
                        }
                    };

                    peer.ontrack = (event) => {
                        // Thứ tự m-line trong offer: 0 = webcam, 1 = màn hình.
                        const index = peer
                            .getTransceivers()
                            .indexOf(event.transceiver);

                        const stream = new MediaStream([event.track]);

                        const show = () => {
                            if (pc !== peer) return;

                            if (index === 0) {
                                setCameraStream(stream);
                                setStatus("live");
                            } else if (index === 1) {
                                setScreenStream(stream);
                            }
                        };

                        const hide = () => {
                            if (pc !== peer) return;

                            if (index === 0) {
                                setCameraStream(null);
                                setStatus("waiting");
                            } else if (index === 1) {
                                setScreenStream(null);
                            }
                        };

                        event.track.onunmute = show;
                        event.track.onmute = hide;
                        event.track.onended = hide;

                        if (!event.track.muted) show();
                    };

                    peer.onconnectionstatechange = () => {
                        if (pc !== peer) return;

                        window.clearTimeout(disconnectTimer);

                        if (peer.connectionState === "disconnected") {
                            disconnectTimer = window.setTimeout(
                                () => signaling.restart(),
                                5000,
                            );
                        } else if (peer.connectionState === "failed") {
                            setStatus("waiting");
                            signaling.restart();
                        }
                    };

                    await peer.setRemoteDescription(
                        message.payload as RTCSessionDescriptionInit,
                    );

                    for (const candidate of pendingIce.splice(0)) {
                        await peer
                            .addIceCandidate(candidate)
                            .catch(() => undefined);
                    }

                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);

                    signaling.send({
                        type: "answer",
                        payload: peer.localDescription ?? answer,
                    });
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
    }, [attemptId]);

    useEffect(() => {
        const video = videoRef.current;

        if (!video) return;

        video.srcObject = cameraStream;

        if (cameraStream) {
            void video.play().catch(() => undefined);
        }
    }, [cameraStream]);

    return {
        videoRef,
        cameraStream,
        screenStream,
        status,
    };
}