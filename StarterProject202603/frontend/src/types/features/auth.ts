export interface LoginRequest {
  email: string;
  password: string;
  isRememberedMe?: boolean;
}

export interface LoginResponse {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
}

export interface AuthContextType {
  user: LoginResponse | null;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isAuthenticated: boolean;
  setGoogleUser: (user: LoginResponse) => void;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  confirmPassword: string;
}
export interface VerifyRequest {
  email: string;
  code: string;
}

export interface ForgotPasswordEmailRequest {
  email: string;
}

export interface ForgotPasswordRequest {
  token: string;
  newPassword: string;
}
export interface ResetPasswordData {
  password: string;
  confirmPassword: string;
}
export interface AuthState {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
  isAuthenticated: boolean;
}
