import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from "react-router-dom";

export function createTestQueryClient() {
    return new QueryClient({
        // retryDelay 0: the app retries a failed query once for 5xx / network errors; do it immediately in tests
        defaultOptions: { queries: { retryDelay: 0, gcTime: 0 }, mutations: { retry: false } },
    });
}

/** Prints the current URL so a test can assert where a click navigated to. */
function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

export interface TestRoute {
    path: string;
    element: ReactElement;
}

export function renderRoutes(routes: TestRoute[], options: { route: InitialEntry; client?: QueryClient }) {
    const client = options.client ?? createTestQueryClient();
    const user = userEvent.setup();

    const view = render(
        <QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[options.route]}>
                <Routes>
                    {routes.map((route) => (
                        <Route key={route.path} path={route.path} element={route.element} />
                    ))}
                </Routes>
                <LocationProbe />
            </MemoryRouter>
        </QueryClientProvider>,
    );

    return { ...view, client, user };
}

/** Renders one element inside the providers it needs, at the given URL. */
export function renderAt(element: ReactElement, options: { route: InitialEntry; path?: string; client?: QueryClient }) {
    return renderRoutes([{ path: options.path ?? "*", element }], options);
}
