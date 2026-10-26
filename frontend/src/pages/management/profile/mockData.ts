import type { UserProfileData } from "./types";

export const initialProfileData: UserProfileData = {
  fullName: "Trần Minh Anh",
  email: "anh.tm@fams.vn",
  employeeCode: "EMP10014",
  phoneNumber: "0903 221 879",
  role: "PROGRAM MANAGER",
  department: "FHN.G2",
  status: "Active",
  initials: "TA",
  lastLogin: null,
  lastLoginAt: null,
  device: null,
  skills: [
    { name: "Java", color: "blue" },
    { name: "Curriculum", color: "blue" },
    { name: "Agile", color: "blue" },
  ],
};
