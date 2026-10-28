import { usePermissions } from "@/hooks/usePermissions";
import ToggleTheme from "@/components/ToggleTheme";
import { startTransition, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import type { RootState } from "@/store/store";
import { useDispatch, useSelector } from "react-redux";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";
import { ChevronDown, ShieldCheck, GraduationCap, User, LogOut } from "lucide-react";
import {
  formatRoleLabel,
  getHomePathByRole,
  normalizeRole,
} from "@/utils/rbac.utils";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { setLogout } from "@/store/slices/auth/authSlice";
import { initialProfileData } from "@/pages/management/profile/mockData";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HeaderRight() {
  const { canLearn } = usePermissions();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const { role, roles, isAuthenticated } = auth;
  const { activeRole, availableRoles, isPreviewMode, setViewRole } = useRoleSwitch();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const primaryRole = normalizeRole(role);
  void roles;
  const canSwitchRole = availableRoles.length > 1;
  const currentRole = activeRole ?? primaryRole;
  const isStudentRole = currentRole === "STUDENT";

  // Compute initials helper
  const computeInitials = (name: string): string => {
    if (!name) return "TA";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const authFullName =
    auth.firstName && auth.lastName
      ? `${auth.firstName} ${auth.lastName}`
      : auth.firstName || "";

  const userName = authFullName.trim() || initialProfileData.fullName;
  const userEmail = auth.email || initialProfileData.email;
  const userInitials = computeInitials(userName);
  const userRoleDisplay = role ? formatRoleLabel(primaryRole) : initialProfileData.role;

  const handleLogout = async () => {
    if (isAuthenticated) {
      try {
        await authApi.logout();
      } catch {
        // Proceed with client logout even if backend is offline
      }
    }
    dispatch(setLogout());
    navigate("/login");
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const switchRole = (nextRole: string) => {
    const normalizedRole = normalizeRole(nextRole);
    setOpen(false);

    // Đổi role và đổi trang trong CÙNG một lần cập nhật. Nếu tách ra, React có một lượt render
    // mà role mới đã có hiệu lực nhưng URL vẫn là trang cũ -> trang cũ bị coi là không có quyền
    // (403) hoặc không tồn tại với role mới (404) và bị đẩy sang trang lỗi.
    startTransition(() => {
      setViewRole(normalizedRole === primaryRole ? null : normalizedRole);
      navigate(getHomePathByRole(normalizedRole, auth.permissions), { replace: true });
    });
  };

  const renderUserAccountMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-gray-100 dark:hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="User Account Menu"
        >
          <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center border border-blue-200/60 dark:border-blue-900/50 select-none shadow-2xs">
            {userInitials}
          </div>
          <div className="hidden sm:flex flex-col text-left leading-tight">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
              {userName}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              {userRoleDisplay}
            </span>
          </div>
          <ChevronDown className="size-3 text-muted-foreground hidden sm:inline-block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-lg">
        <DropdownMenuLabel className="p-2 font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-semibold text-foreground leading-none">{userName}</p>
            <p className="text-xs text-muted-foreground leading-none truncate">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => navigate("/fams/ho-so-ca-nhan-oi-mat-khau")}
          className="cursor-pointer gap-2.5 py-2"
        >
          <User className="size-4 text-blue-600 dark:text-blue-400" />
          <span>My Profile</span>
        </DropdownMenuItem>

        {canLearn && <DropdownMenuItem
          onClick={() => navigate("/my-learning")}
          className="cursor-pointer gap-2.5 py-2"
        >
          <GraduationCap className="size-4 text-blue-600 dark:text-blue-400" />
          <span>My Learning</span>
        </DropdownMenuItem>}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer gap-2.5 py-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
        >
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!role) {
    return (
      <div className="flex items-center gap-3">
        {renderUserAccountMenu()}
        <ToggleTheme />
      </div>
    );
  }

  if (!canSwitchRole) {
    return (
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className="text-sm text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
        >
          {formatRoleLabel(currentRole)} View
        </Badge>
        {renderUserAccountMenu()}
        <ToggleTheme />
      </div>
    );
  }


  return (
    <div className="flex items-center gap-3" ref={dropdownRef}>
      {/* Existing Role / View-mode selector */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer dark:bg-card dark:border-border dark:text-foreground ${isStudentRole
            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
            }`}
        >
          {isStudentRole ? (
            <GraduationCap size={14} />
          ) : (
            <ShieldCheck size={14} />
          )}
          <span>{formatRoleLabel(currentRole)} View</span>
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-44 bg-card text-card-foreground border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {availableRoles.map((availableRole) => {
              const selected = normalizeRole(availableRole) === currentRole;
              const isAssignedRole = true;
              const studentRow = normalizeRole(availableRole) === "STUDENT";

              return (
                <button
                  key={availableRole}
                  onClick={() => switchRole(availableRole)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer ${selected
                    ? studentRow
                      ? "text-green-700 font-medium bg-green-50 dark:bg-green-950/60 dark:text-green-300"
                      : "text-blue-700 font-medium bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300"
                    : "text-gray-700 dark:text-foreground"
                    }`}
                >
                  {studentRow ? <GraduationCap size={15} /> : <ShieldCheck size={15} />}
                  {formatRoleLabel(availableRole)} View
                  {(selected || !isAssignedRole) && (
                    <span className="ml-auto flex items-center gap-2">
                      {selected && (
                        <span className={`text-xs ${studentRow ? "text-green-500" : "text-blue-500"}`}>
                          ●
                        </span>
                      )}
                      {!isAssignedRole && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Preview
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isPreviewMode && (
        <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
          Preview
        </Badge>
      )}

      {/* User Account Dropdown */}
      {renderUserAccountMenu()}

      <ToggleTheme />
    </div>
  );
}
