export function validateTrainerProfile(name: string, email: string) {
  const errors: { name?: string; email?: string } = {};
  if (!name.trim() || name.length > 200) errors.name = "Enter a trainer name (up to 200 characters).";
  if (email.length > 200) errors.email = "Enter an email address of at most 200 characters.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}
