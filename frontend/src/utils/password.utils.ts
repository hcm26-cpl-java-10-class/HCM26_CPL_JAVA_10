export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/** Checklist shown live while typing. Keep in sync with backend PasswordPolicy. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH && p.length <= PASSWORD_MAX_LENGTH,
  },
  { id: "letter", label: "At least one letter", test: (p) => /\p{L}/u.test(p) },
  { id: "digit", label: "At least one number", test: (p) => /\d/.test(p) },
  { id: "space", label: "No spaces", test: (p) => !/\s/.test(p) },
];

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "12345678",
  "123456789", "1234567890", "11111111", "00000000", "qwerty123", "qwertyuiop", "qwerty12",
  "iloveyou", "admin123", "administrator", "welcome1", "welcome123", "letmein1", "abc12345",
  "abcd1234", "1q2w3e4r", "1qaz2wsx", "changeme", "changeme1", "default123", "test1234",
  "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1", "master123",
]);

/** Returns the first problem found, or undefined when the password is acceptable. */
export function validatePasswordStrength(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (/\s/.test(password)) return "Password must not contain spaces.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "This password is too common. Choose something less predictable.";
  }
  return undefined;
}
