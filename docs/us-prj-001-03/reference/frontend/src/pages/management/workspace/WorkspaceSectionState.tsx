import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import { getWorkspaceError } from "./workspace.shared";

export const sectionForbidden = (error: unknown) => isAxiosError(error) && error.response?.status === 403;

export function WorkspaceSectionState({ loading, denied, error, retry }: {
  loading?: boolean; denied?: boolean; error?: unknown; retry: () => void;
}) {
  return <Card>
    <CardHeader><CardTitle>{denied ? "Access changed" : loading ? "Loading section..." : "Unable to load section"}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <>
        <p className="text-sm">{denied ? "Your access to this section has changed. Reload the available sections." : getWorkspaceError(error)}</p>
        <Button variant="outline" onClick={retry}>{denied ? "Reload access" : "Try again"}</Button>
      </>}
    </CardContent>
  </Card>;
}
