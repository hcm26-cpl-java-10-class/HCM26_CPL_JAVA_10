// Shared error panel for exam pages: gives 403 / 404 / 409 their own wording instead of a blank screen.
import axios from 'axios';
import { Button } from '@/components/ui/button';

export function apiErrorStatus(error: unknown): number | null {
    return axios.isAxiosError(error) ? (error.response?.status ?? null) : null;
}

const COPY: Record<number, { title: string; hint: string }> = {
    403: { title: 'Access denied', hint: 'You do not have permission to view or change this.' },
    404: { title: 'Not found', hint: 'This item does not exist or you cannot see it.' },
    409: { title: 'Data changed', hint: 'Someone else changed this data. Reload to see the latest version.' },
};

export function ApiErrorState({ error, onRetry, onBack }: { error: unknown; onRetry?: () => void; onBack?: () => void }) {
    const status = apiErrorStatus(error);
    const copy = (status != null && COPY[status]) || { title: 'Something went wrong', hint: 'Could not load this page. Try again.' };
    const serverMessage = axios.isAxiosError(error) ? (error.response?.data as { message?: string } | undefined)?.message : undefined;
    return (
        <div role="alert" className="mx-auto mt-16 max-w-md space-y-3 rounded-xl border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">{copy.title}{status ? ` (${status})` : ''}</h2>
            <p className="text-sm text-muted-foreground">{copy.hint}</p>
            {serverMessage && <p className="text-xs text-muted-foreground">{serverMessage}</p>}
            <div className="flex justify-center gap-2">
                {onBack && <Button variant="outline" onClick={onBack}>Back</Button>}
                {onRetry && status !== 403 && status !== 404 && <Button onClick={onRetry}>{status === 409 ? 'Reload' : 'Try again'}</Button>}
            </div>
        </div>
    );
}
