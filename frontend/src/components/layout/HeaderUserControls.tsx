import { Bell } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import type { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import { formatRoleLabel } from "@/utils/rbac.utils";
import { getUserAvatarInitials } from "@/utils/user-display.utils";

export function HeaderUserControls() {
    const { role, roles, firstName, lastName, email } = useSelector((state: RootState) => state.auth);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const sessionName = email.includes("@") ? email.slice(0, email.indexOf("@")) : email;
    const userName = fullName || sessionName || "Người dùng";
    const userRole = role || roles[0];
    const roleLabel = userRole ? formatRoleLabel(userRole) : "Chưa xác định";
    const initials = getUserAvatarInitials(fullName, email);

    return (
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Popover open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label="Thông báo"
                        aria-expanded={isNotificationOpen}
                        className="relative flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                        <Bell className="size-5" aria-hidden="true" />
                        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-orange-600" />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                    <PopoverHeader className="border-b border-slate-100 px-4 py-3">
                        <PopoverTitle className="text-sm font-semibold text-slate-900">Thông báo</PopoverTitle>
                        <PopoverDescription className="text-xs text-slate-500">
                            Cập nhật mới nhất dành cho bạn
                        </PopoverDescription>
                    </PopoverHeader>
                    <div className="px-4 py-8 text-center">
                        <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                            <Bell className="size-5" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-medium text-slate-700">Không có thông báo mới</p>
                    </div>
                </PopoverContent>
            </Popover>

            <div className="flex min-w-0 items-center gap-2.5">
                <div
                    role="img"
                    aria-label={`Ảnh đại diện ${userName}`}
                    title={userName}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700"
                >
                    {initials}
                </div>
                <div className="hidden min-w-0 sm:block">
                    <p className="max-w-40 truncate text-sm font-semibold leading-5 text-slate-900">{userName}</p>
                    <p className="max-w-40 truncate text-xs leading-4 text-slate-500">{roleLabel}</p>
                </div>
            </div>
        </div>
    );
}
