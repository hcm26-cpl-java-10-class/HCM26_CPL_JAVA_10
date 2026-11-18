import axiosInstance from "@/api/axios";

const API_URL =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:8080/api";

/** Ưu tiên VITE_WS_URL; không có thì suy ra từ VITE_API_URL (http->ws, https->wss). */
const WS_BASE =
    (import.meta.env.VITE_WS_URL as string | undefined) ||
    API_URL.replace(/\/api\/?$/, "").replace(/^http/, "ws");

const TURN_URL = import.meta.env.VITE_TURN_URL as string | undefined;

export const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    ...(TURN_URL
        ? [
            {
                urls: TURN_URL,
                username: import.meta.env.VITE_TURN_USER as string,
                credential: import.meta.env.VITE_TURN_PASS as string,
            },
        ]
        : []),
];

/** Chỉ offer VP8 (+rtx) để SDP ngắn lại (Chrome mặc định liệt kê VP8/VP9/AV1/H264...). */
export function preferVp8(transceiver: RTCRtpTransceiver) {
    try {
        const codecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
        const wanted = codecs.filter((c) =>
            /^video\/(vp8|rtx)$/i.test(c.mimeType),
        );

        if (wanted.some((c) => /vp8/i.test(c.mimeType))) {
            transceiver.setCodecPreferences(wanted);
        }
    } catch {
        // Trình duyệt cũ không hỗ trợ: dùng codec mặc định.
    }
}

export type SignalingRole = "STUDENT" | "SUPERVISOR";
export type SignalingState = "connecting" | "open" | "closed" | "denied";

export interface SignalingMessage {
    type: string;
    payload?: unknown;
}

export interface SignalingClient {
    send: (message: SignalingMessage) => void;
    /** Đóng kết nối hiện tại, tự nối lại bằng ticket mới. */
    restart: () => void;
    close: () => void;
}

/**
 * WebSocket signaling có tự nối lại (ticket dùng 1 lần nên mỗi lần nối lại xin ticket mới).
 * Tin nhắn được xử lý TUẦN TỰ để offer/answer/ice không chạy chồng nhau.
 */
export function connectSignaling(options: {
    attemptId: number;
    role: SignalingRole;
    onState: (state: SignalingState) => void;
    onMessage: (message: SignalingMessage) => void | Promise<void>;
}): SignalingClient {
    const { attemptId, role, onState, onMessage } = options;

    let disposed = false;
    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;
    let retries = 0;
    let chain: Promise<unknown> = Promise.resolve();

    const scheduleRetry = () => {
        if (disposed) return;

        window.clearTimeout(retryTimer);

        const delay = Math.min(1000 * 2 ** retries, 10_000);
        retries += 1;

        retryTimer = window.setTimeout(() => void open(), delay);
    };

    const open = async () => {
        if (disposed) return;

        onState("connecting");

        try {
            const { data } = await axiosInstance.post<{ ticket: string }>(
                "/exam-supervisor/signaling-ticket",
                { attemptId, role },
            );

            if (disposed) return;

            const socket = new WebSocket(
                `${WS_BASE}/ws/exam-supervisor?ticket=${encodeURIComponent(
                    data.ticket,
                )}`,
            );

            ws = socket;

            socket.onopen = () => {
                retries = 0;
                onState("open");
            };

            socket.onmessage = (event) => {
                let message: SignalingMessage;

                try {
                    message = JSON.parse(String(event.data)) as SignalingMessage;
                } catch {
                    return;
                }

                chain = chain
                    .then(() => onMessage(message))
                    .catch((error) =>
                        console.warn("[exam-supervisor] handler error", error),
                    );
            };

            socket.onclose = (event) => {
                if (ws === socket) ws = null;

                console.warn(
                    `[exam-supervisor] signaling closed (code ${event.code})`,
                );

                if (disposed) return;

                onState("closed");
                scheduleRetry();
            };
        } catch (error) {
            const status = (error as { response?: { status?: number } })
                ?.response?.status;

            // 4xx (hết quyền, lượt thi đã kết thúc...) thì không retry vô hạn.
            if (status && status >= 400 && status < 500) {
                onState("denied");
                return;
            }

            onState("closed");
            scheduleRetry();
        }
    };

    void open();

    return {
        send: (message) => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        },
        restart: () => {
            ws?.close();
        },
        close: () => {
            disposed = true;
            window.clearTimeout(retryTimer);
            ws?.close();
            ws = null;
        },
    };
}