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

export const profileApi = {
  getProfile: async (): Promise<UserProfileData> => {
    const res = await axiosInstance.get<BackendProfileResponse>("/profile");
    const data = res.data;

    return {
      fullName: data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "User",
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || "",
      employeeCode: data.employeeCode || "EMP10014",
      phoneNumber: data.phoneNumber || "",
      role: data.role || "USER",
      department: data.department || "FHN.G2",
      status: data.status || "Active",
      initials: computeInitials(data.fullName || data.firstName || ""),
      lastLogin: data.lastLogin || "12/08/2026 10:24",
      device: data.device || "Chrome · Windows 11",
      skills: (data.skills && data.skills.length > 0
        ? data.skills.map((s, idx) => ({
            name: s,
            color: idx === 0 ? "blue" : idx === 1 ? "green" : "orange",
          }))
        : [
            { name: "Java", color: "blue" },
            { name: "Curriculum", color: "green" },
            { name: "Agile", color: "orange" },
          ]) as UserProfileData["skills"],
    };
  },

  updateProfile: async (payload: UpdateProfilePayload): Promise<UserProfileData> => {
    const res = await axiosInstance.put<BackendProfileResponse>("/profile", payload);
    const data = res.data;

    return {
      fullName: data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      employeeCode: data.employeeCode || "EMP10014",
      phoneNumber: data.phoneNumber || "",
      role: data.role,
      department: data.department || "FHN.G2",
      status: data.status || "Active",
      initials: computeInitials(data.fullName || data.firstName || ""),
      lastLogin: data.lastLogin || "12/08/2026 10:24",
      device: data.device || "Chrome · Windows 11",
      skills: [
        { name: "Java", color: "blue" },
        { name: "Curriculum", color: "green" },
        { name: "Agile", color: "orange" },
      ],
    };
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<void> => {
    await axiosInstance.post("/profile/change-password", payload);
  },
};
