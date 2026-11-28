import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no layout engine; the UI kit (Radix popovers/dialogs, the table auto-sizing hook) expects these.
class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
}

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};

// jsdom không có `requestIdleCallback`; bộ lập lịch của translator dùng API này khi trình duyệt hỗ trợ.
if (typeof window.requestIdleCallback === "undefined") {
    window.requestIdleCallback = ((callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
        window.setTimeout(() => callback({
            didTimeout: false,
            timeRemaining: () => 0,
        }), 0)) as typeof window.requestIdleCallback;

    window.cancelIdleCallback = ((handle: number) =>
        window.clearTimeout(handle)) as typeof window.cancelIdleCallback;
}

afterEach(() => {
    cleanup();
    localStorage.clear();
});
