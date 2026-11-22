export function validateWeightDraft(draft: Record<string, string>) {
  let total = 0;
  for (const value of Object.values(draft)) {
    // Blank keeps an existing unset weight; edited values must be explicit numbers.
    if (!value.trim()) continue;
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 100)
      return { total, error: "Enter weights from 0 to 100 with at most two decimal places." };
    total += Math.round(Number(value) * 100);
  }
  total /= 100;
  return { total, error: total > 100 ? "Assessment weights cannot exceed 100%." : null };
}
