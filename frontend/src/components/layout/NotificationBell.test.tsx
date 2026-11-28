import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { notificationApi } from "@/api";
import { NotificationBell } from "./NotificationBell";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "student@example.com" } }) }));
vi.mock("@/hooks/usePendingInvitations", () => ({ usePendingInvitations: () => ({ pending: [{ id: 44 }], count: 1, isError: false }) }));
vi.mock("@/api", () => ({ notificationApi: { getMine: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() } }));

const result = { items: [{ id: 5, title: "Course update", message: "Updated", read: false, createdAt: "2026-11-23T10:00:00" }], unreadCount: 1, page: 0, totalPages: 2, totalItems: 11 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notificationApi.getMine).mockResolvedValue(result);
  vi.mocked(notificationApi.markRead).mockResolvedValue();
  vi.mocked(notificationApi.markAllRead).mockResolvedValue();
});

it("uses one general bell and keeps pending exam invitations accessible", async () => {
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><NotificationBell /></MemoryRouter></QueryClientProvider>);
  const bell = await screen.findByRole("button", { name: /Notifications: 1 unread; exam invitations: 1 pending/ });
  expect(screen.getAllByRole("button", { name: /Notifications:/ })).toHaveLength(1);
  await user.click(bell);
  expect(await screen.findByRole("button", { name: /Exam invitations/ })).toHaveTextContent("1 pending invitation");
  expect(screen.getByRole("navigation", { name: "Notification history pages" })).toBeInTheDocument();
});

it("offers retry feedback when a read action fails", async () => {
  vi.mocked(notificationApi.markRead).mockRejectedValueOnce(new Error("offline")).mockResolvedValue();
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><NotificationBell /></MemoryRouter></QueryClientProvider>);
  await user.click(await screen.findByRole("button", { name: /Notifications:/ }));
  await user.click(await screen.findByRole("button", { name: /Course update/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not update notification status");
  await user.click(screen.getByRole("button", { name: /Retry/ }));
  expect(notificationApi.markRead).toHaveBeenCalledTimes(2);
});
