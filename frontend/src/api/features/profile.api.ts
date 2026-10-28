import axiosInstance from "../axios";
import type { UserProfileData } from "@/pages/management/profile/types";

export interface BackendProfileResponse {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  phoneNumber: string;
  role: string;
  roles: string[];
  department: string;
  status: "Active" | "Inactive";
  lastLogin: string | null;
  lastLoginAt?: string | null;
  device: string | null;
  skills: string[];
}

export interface UpdateProfilePayload {
  fullName: string;
  phoneNumber: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword?: string;
}

const computeInitials = (name: string): string => {
  if (!name) return "TA";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const mapProfile = (data: BackendProfileResponse): UserProfileData => ({
  fullName: data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
  firstName: data.firstName, lastName: data.lastName, email: data.email || "",
  employeeCode: data.employeeCode || "", phoneNumber: data.phoneNumber || "",
  role: data.role || "USER", department: data.department || "", status: data.status,
  initials: computeInitials(data.fullName || data.firstName || ""),
  lastLogin: data.lastLoginAt || data.lastLogin || null,
  lastLoginAt: data.lastLoginAt || data.lastLogin || null, device: data.device || null,
  skills: (data.skills ?? []).map(name => ({ name, color: "blue" as const })),
});

export const profileApi = {
  getProfile: async (): Promise<UserProfileData> => mapProfile((await axiosInstance.get<BackendProfileResponse>("/profile")).data),
  updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfileData> =>
    mapProfile((await axiosInstance.put<BackendProfileResponse>("/profile", payload)).data),
  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await axiosInstance.post("/profile/change-password", payload);
  },
};
