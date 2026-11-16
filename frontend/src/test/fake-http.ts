import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

type Method = "get" | "post" | "put" | "patch" | "delete";

export interface RecordedCall {
    method: Method;
    url: string;
    /** query parameters: a URLSearchParams or a plain object, exactly as the app passed them to axios */
    params?: unknown;
    /** request body */
    data?: unknown;
}

type Handler = (call: RecordedCall) => unknown;

interface Route {
    method: Method;
    matcher: string | RegExp;
    handler: Handler;
}

/** An axios-shaped error, so the code under test sees what it would see from a real failed request. */
export function httpError(status: number, body: unknown = {}): AxiosError {
    const config = { headers: {} } as InternalAxiosRequestConfig;
    const response = { status, statusText: String(status), data: body, headers: {}, config } as AxiosResponse;
    return new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}

/** A request that never got an answer (server down, offline). */
export function networkError(): AxiosError {
    return new AxiosError("Network Error", AxiosError.ERR_NETWORK, { headers: {} } as InternalAxiosRequestConfig);
}

/** A tiny in-memory stand-in for the backend: tests register the answers and inspect the requests that were made. */
class FakeHttp {
    calls: RecordedCall[] = [];
    private routes: Route[] = [];

    reset() {
        this.calls = [];
        this.routes = [];
    }

    /** The most recently registered matching route wins, so a test can override a default answer. */
    on(method: Method, matcher: string | RegExp, answer: Handler | unknown) {
        const handler: Handler = typeof answer === "function" ? (answer as Handler) : () => answer;
        this.routes.push({ method, matcher, handler });
    }

    callsTo(method: Method, matcher: string | RegExp): RecordedCall[] {
        return this.calls.filter((call) => call.method === method && this.matches(matcher, call.url));
    }

    private matches(matcher: string | RegExp, url: string) {
        return typeof matcher === "string" ? matcher === url : matcher.test(url);
    }

    private async dispatch(method: Method, url: string, params?: unknown, data?: unknown) {
        const call: RecordedCall = { method, url, params, data };
        this.calls.push(call);

        const route = [...this.routes].reverse().find((candidate) => candidate.method === method && this.matches(candidate.matcher, url));
        if (!route) {
            throw new Error(`FakeHttp: no answer registered for ${method.toUpperCase()} ${url}`);
        }

        return { data: await route.handler(call), status: 200 };
    }

    /** Has the same surface as the axios instance the app uses (`@/api/axios`). */
    readonly axios = {
        get: (url: string, config?: { params?: unknown }) => this.dispatch("get", url, config?.params),
        delete: (url: string, config?: { params?: unknown }) => this.dispatch("delete", url, config?.params),
        post: (url: string, data?: unknown, config?: { params?: unknown }) => this.dispatch("post", url, config?.params, data),
        put: (url: string, data?: unknown, config?: { params?: unknown }) => this.dispatch("put", url, config?.params, data),
        patch: (url: string, data?: unknown, config?: { params?: unknown }) => this.dispatch("patch", url, config?.params, data),
    };
}

export const fakeHttp = new FakeHttp();

/** Spring's page envelope, as returned by GET /api/<entity>. */
export function pageOf<T>(content: T[], extra: { page?: number; totalPages?: number } = {}) {
    return {
        content,
        page: extra.page ?? 0,
        size: content.length,
        totalPages: extra.totalPages ?? 1,
        totalElements: content.length,
    };
}
