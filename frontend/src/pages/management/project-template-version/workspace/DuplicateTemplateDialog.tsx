import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectTemplateVersionDTO } from "@/types";
import { CopyPlus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { versionLabel } from "./version.constants";

interface DuplicateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Version whose template will be duplicated. */
  source: ProjectTemplateVersionDTO | null;
  loading?: boolean;
  onConfirm: (payload: { code: string; name: string }) => void | Promise<void>;
}

interface FieldErrors {
  code?: string;
  name?: string;
}

/**
 * Confirmation of the "Duplicate" action (US-08 / AC01).
 * <p>
 * Only the identity of the copy is asked for: a new (unique) code and a new
 * name. Everything else is handled by the server - the configuration (rules,
 * milestones, rubric) is copied from the selected template, the version is
 * always `v1.0`, the status always `DRAFT` and the copy keeps no
 * `parentTemplateId` link back to the original.
 * <p>
 * The template code / name are not displayed because the Project Template
 * module is owned by another team and is not resolved by this page yet.
 */
export function DuplicateTemplateDialog({
  open,
  onOpenChange,
  source,
  loading = false,
  onConfirm,
}: DuplicateTemplateDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Reset the form every time the dialog opens for a (possibly) new source. */
  useEffect(() => {
    if (!open) return;
    setCode("");
    setName("");
    setErrors({});
  }, [open, source?.id]);

  const validate = () => {
    const next: FieldErrors = {};

    if (!code.trim()) next.code = "Vui lòng nhập mã Project Template";
    if (!name.trim()) next.name = "Vui lòng nhập tên Project Template";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirm = () => {
    if (loading || !source?.id) return;
    if (!validate()) return;

    void onConfirm({ code: code.trim(), name: name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CopyPlus className="h-5 w-5 text-primary" />
            </span>
            Duplicate Project Template
          </DialogTitle>
          <DialogDescription className="pt-2">
            A new independent Project Template will be created from{" "}
            <span className="font-semibold text-foreground">
              {versionLabel(source)}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duplicate-template-code" className="text-xs">
              New code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="duplicate-template-code"
              value={code}
              maxLength={100}
              placeholder="e.g. TPL-CAPSTONE-2026"
              autoComplete="off"
              disabled={loading}
              aria-invalid={Boolean(errors.code)}
              onChange={(event) => {
                setCode(event.target.value);
                if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
              }}
            />
            {errors.code && (
              <p className="text-[11px] font-medium text-destructive">{errors.code}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duplicate-template-name" className="text-xs">
              New name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="duplicate-template-name"
              value={name}
              maxLength={255}
              placeholder="e.g. Capstone Project Template (Copy)"
              autoComplete="off"
              disabled={loading}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
            {errors.name && (
              <p className="text-[11px] font-medium text-destructive">{errors.name}</p>
            )}
          </div>

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>
              The code must not be used by another Project Template and the copy
              is stored as{" "}
              <span className="font-semibold text-foreground">DRAFT</span>.
            </li>
            <li>
              The version starts at{" "}
              <span className="font-semibold text-foreground">v1.0</span>.
            </li>
            <li>
              Rules, milestones and rubric are copied, but no version-tree link
              (<span className="font-mono text-[11px]">parent_template_id</span>)
              is kept to the original template.
            </li>
          </ul>
        </div>

        <DialogFooter>
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={loading || !source}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Duplicating...
                </>
              ) : (
                <>
                  <CopyPlus className="mr-2 h-4 w-4" />
                  Duplicate
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
