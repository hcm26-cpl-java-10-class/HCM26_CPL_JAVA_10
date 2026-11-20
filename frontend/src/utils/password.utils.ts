const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "00000000",
  "qwerty123",
  "qwertyuiop",
  "qwerty12",
  "iloveyou",
  "admin123",
  "administrator",
  "welcome1",
  "welcome123",
  "letmein1",
  "abc12345",
  "abcd1234",
  "1q2w3e4r",
  "1qaz2wsx",
  "changeme",
  "changeme1",
  "default123",
  "test1234",
  "monkey123",
  "dragon123",
  "football1",
  "baseball1",
  "sunshine1",
  "princess1",
  "master123",
]);

export function validatePasswordStrength(password: string): string | undefined {
  if (password.length < 8 || password.length > 64) {
    return "Password must be 8-64 characters.";
  }
  if (/\s/.test(password)) {
    return "Password must not contain spaces.";
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "This password is too common. Choose something less predictable.";
  }
  return undefined;
}
