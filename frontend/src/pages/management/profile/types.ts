export interface SkillItem {
  name: string;
  color: "blue" | "green" | "orange" | "purple" | "gray";
}

export interface UserProfileData {
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  employeeCode: string;
  phoneNumber: string;
  role: string;
  department: string;
  status: "Active" | "Inactive";
  initials: string;
  lastLogin: string | null;
  lastLoginAt?: string | null;
  device: string | null;
  skills: SkillItem[];
}

export interface ProfileFormValues {
  fullName: string;
  phoneNumber: string;
}

export interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ProfileFormErrors {
  fullName?: string;
  phoneNumber?: string;
}

export interface PasswordFormErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  general?: string;
}
