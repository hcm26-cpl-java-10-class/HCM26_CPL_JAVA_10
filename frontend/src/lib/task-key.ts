/**
 * US-SY-05 helpers: the text developers copy so their commits get linked to a task
 * automatically (the Task ID only has to appear in the commit message).
 */

const MAX_BRANCH_SLUG = 40;

/** `Thêm trang giỏ hàng` → `them-trang-gio-hang` (accents removed, lower case, dashes). */
export function slugify(text: string, max = MAX_BRANCH_SLUG): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/** `FA-21: Thêm trang giỏ hàng` */
export function taskCommitMessage(taskKey: string, title?: string | null): string {
  const summary = title?.trim();
  return summary ? `${taskKey}: ${summary}` : `${taskKey}: `;
}

/** `feature/FA-21-them-trang-gio-hang` */
export function taskBranchName(taskKey: string, title?: string | null): string {
  const slug = slugify(title ?? "");
  return slug ? `feature/${taskKey}-${slug}` : `feature/${taskKey}`;
}
