import type { UserProfileData } from "./types";

// Blank shell until the authenticated account profile is loaded.
export const initialProfileData: UserProfileData = {
  fullName: "", email: "", employeeCode: "", phoneNumber: "", role: "",
  department: "", status: "Active", initials: "", lastLogin: null,
  lastLoginAt: null, device: null, skills: [],
};
