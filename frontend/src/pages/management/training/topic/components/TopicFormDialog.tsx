import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TECHNICAL_GROUP_OPTIONS,
  TECHNICAL_GROUP_VALUES,
  topicFormSchema,
  type TopicFormInput,
  type TopicFormValues,
} from "@/schemas/topic.schema";
import { useTopicMutations } from "@/hooks/useTopics";
import { describeApiError } from "@/utils/api-error.utils";

interface TopicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTopic: TopicItem | null;
  onSaved?: (saved: TopicItem) => void;
  onConfigureOutline?: (topic: TopicItem) => void;
}

export function TopicFormDialog({
  open,
  onOpenChange,
  editingTopic,
  onSaved,
  onConfigureOutline,
}: TopicFormDialogProps) {
  const { createTopic, updateTopic } = useTopicMutations();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TopicFormInput, unknown, TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      code: "",
      name: "",
      version: "1.0",
      technicalGroup: "Backend",
      durationHours: 40,
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editingTopic) {
      reset({
        code: editingTopic.code,
        name: editingTopic.name,
        version: editingTopic.version,
        technicalGroup: editingTopic.technicalGroup || "Backend",
        durationHours: editingTopic.durationHours,
        description: editingTopic.description || "",
        isActive: editingTopic.isActive,
      });
    } else {
      reset({
        code: "",
        name: "",
        version: "1.0",
        technicalGroup: "Backend",
        durationHours: 40,
        description: "",
        isActive: true,
      });
    }
  }, [open, editingTopic, reset]);

  const [watchedCode, watchedVersion, watchedName, watchedDescription, watchedGroup] = useWatch({
    control,
    name: ["code", "version", "name", "description", "technicalGroup"],
  });

  const codeLen = (watchedCode || "").length;
  const versionLen = (watchedVersion || "").length;
  const nameLen = (watchedName || "").length;
  const descLen = (watchedDescription || "").length;
  const currentGroup = watchedGroup || "";
  const isCustomGroup =
    currentGroup !== "" &&
    !(TECHNICAL_GROUP_VALUES as readonly string[]).includes(currentGroup);

  const onSubmit = async (values: TopicFormValues) => {
    try {
      const payload = {
        name: values.name,
        version: values.version,
        technicalGroup: values.technicalGroup || undefined,
        durationHours: values.durationHours,
        description: values.description || "",
        isActive: values.isActive,
      };

      if (editingTopic) {
        const updated = await updateTopic.mutateAsync({
          id: editingTopic.id,
          data: payload,
        });
        toast.success("Topic updated successfully!");
        onOpenChange(false);
        onSaved?.(updated);
      } else {
        const created = await createTopic.mutateAsync({
          ...payload,
          code: values.code,
        });
        toast.success("Topic created successfully!", {
          action: onConfigureOutline
            ? {
                label: "Configure Outline",
                onClick: () => onConfigureOutline(created),
              }
            : undefined,
        });
        onOpenChange(false);
        onSaved?.(created);
      }
    } catch (error) {
      toast.error(describeApiError(error, "Failed to save topic").message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle>{editingTopic ? "Edit Topic" : "Create New Topic"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2 -mr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Topic Code <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={`text-[10px] font-mono ${
                      codeLen >= 50 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {codeLen}/50
                  </span>
                </div>
                <Input
                  disabled={!!editingTopic}
                  placeholder="e.g. L1_AL_CCGM"
                  maxLength={50}
                  {...register("code", {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                  className="font-mono uppercase text-xs"
                />
                {errors.code && (
                  <p className="text-[11px] text-red-600">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    Version <span className="text-red-500">*</span>
                  </Label>
                  <span
                    className={`text-[10px] font-mono ${
                      versionLen >= 20 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {versionLen}/20
                  </span>
                </div>
                <Input
                  placeholder="e.g. 1.0"
                  maxLength={20}
                  {...register("version")}
                  className="font-mono text-xs"
                />
                {errors.version && (
                  <p className="text-[11px] text-red-600">{errors.version.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Topic Name <span className="text-red-500">*</span>
                </Label>
                <span
                  className={`text-[10px] font-mono ${
                    nameLen >= 255 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {nameLen}/255
                </span>
              </div>
              <Input
                placeholder="e.g. Clean Code and Git Multi-platform"
                maxLength={255}
                {...register("name")}
                className="text-xs"
              />
              {errors.name && (
                <p className="text-[11px] text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Technical Group</Label>
                <Controller
                  name="technicalGroup"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Select group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TECHNICAL_GROUP_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {isCustomGroup && (
                          <SelectItem value={currentGroup}>{currentGroup}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.technicalGroup && (
                  <p className="text-[11px] text-red-600">{errors.technicalGroup.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Duration (Hours) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="e.g. 40"
                  {...register("durationHours")}
                  className="text-xs font-mono h-9"
                />
                {errors.durationHours && (
                  <p className="text-[11px] text-red-600">{errors.durationHours.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ? "ACTIVE" : "INACTIVE"}
                      onValueChange={(v) => field.onChange(v === "ACTIVE")}
                    >
                      <SelectTrigger className="w-full h-9 text-xs">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Description</Label>
                <span
                  className={`text-[10px] font-mono ${
                    descLen >= 1000 ? "text-amber-600 font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {descLen}/1000
                </span>
              </div>
              <Textarea
                rows={4}
                placeholder="Detailed objectives, outline..."
                maxLength={1000}
                {...register("description")}
                className="text-xs resize-y min-h-[90px] max-h-[220px]"
              />
              {errors.description && (
                <p className="text-[11px] text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t mt-3 flex justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {editingTopic ? "Save Changes" : "Create Topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
