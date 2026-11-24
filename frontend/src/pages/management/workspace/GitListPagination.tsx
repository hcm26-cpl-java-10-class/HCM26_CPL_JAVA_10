import { Button } from "@/components/ui/button";

export function GitListPagination({ page, total, pageSize = 10, onChange, label, loading = false }: {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  label: string;
  loading?: boolean;
}) {
  const pages = Math.ceil(total / pageSize);
  const current = Math.max(0, Math.min(page, Math.max(0, pages - 1)));
  return <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
    <span>{total} items · Page {pages ? current + 1 : 0} of {pages}</span>
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="outline" aria-label={`Previous ${label} page`}
        disabled={loading || current === 0} onClick={() => onChange(current - 1)}>Previous</Button>
      <Button type="button" size="sm" variant="outline" aria-label={`Next ${label} page`}
        disabled={loading || current + 1 >= pages} onClick={() => onChange(current + 1)}>Next</Button>
    </div>
  </nav>;
}
