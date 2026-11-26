import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cloneTopicSchema, type CloneTopicValues } from "@/schemas/topic.schema";
import { useTopicMutations } from "@/hooks/useTopics";
import { describeApiError } from "@/utils/api-error.utils";

interface TopicCloneDialogProps {
  topic: TopicItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function suggestNextVersion(version?: string): string {
  const parts = (version || "1.0").split(".");
  const minor = parseInt(parts[1], 10);
  return `${parts[0]}.${Number.isNaN(minor) ? 1 : minor + 1}`;
}

export function TopicCloneDialog({ topic, open, onOpenChange }: TopicCloneDialogProps) {
  const { createTopic } = useTopicMutations();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CloneTopicValues>({
    resolver: zodResolver(cloneTopicSchema),
    defaultValues: { version: "1.1" },
  });

  useEffect(() => {
    if (open && topic) {
      reset({ version: suggestNextVersion(topic.version) });
    }
  }, [open, topic, reset]);

  const watchedVersion = useWatch({ control, name: "version" });
  const versionLen = (watchedVersion || "").length;

  const onSubmit = async (values: CloneTopicValues) => {
    if (!topic) return;
    try {
      await createTopic.mutateAsync({
        code: topic.code,
        name: topic.name,
        version: values.version,
        technicalGroup: topic.technicalGroup,
        durationHours: topic.durationHours,
        description: topic.description,
        isActive: true,
      });
      toast.success(`Cloned to version ${values.version}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, "Clone failed").message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Clone Topic Version</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-3 py-3">
            <p className="text-sm text-gray-600">
              Cloning <b>{topic?.code}</b> (v{topic?.version}) to a new version.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">New Version</Label>
                <span
                  className={`text-[10px] font-mono ${
                    versionLen >= 20 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {versionLen}/20
                </span>
              </div>
              <Input
                placeholder="e.g. 1.1"
                maxLength={20}
                {...register("version")}
                className="font-mono text-xs"
              />
              {errors.version && (
                <p className="text-[11px] text-red-600">{errors.version.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Confirm Clone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
