import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import type { TopicItem } from "@/types/features/content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTopicMutations } from "@/hooks/useTopics";
import { describeApiError } from "@/utils/api-error.utils";

interface TopicDeleteDialogProps {
  topic: TopicItem | null;
  onClose: () => void;
}

export function TopicDeleteDialog({ topic, onClose }: TopicDeleteDialogProps) {
  const { deleteTopic } = useTopicMutations();
  const isDeleting = deleteTopic.isPending;

  const handleConfirmDelete = async () => {
    if (!topic) return;
    try {
      await deleteTopic.mutateAsync(topic.id);
      toast.success(`Topic ${topic.code} deleted successfully`);
      onClose();
    } catch (error) {
      if (error instanceof Error && error.message === "TOPIC_REFERENCED") {
        toast.error(
          `Cannot delete topic ${topic.code}. It is referenced in training programs or schedules. Please deactivate instead.`
        );
        onClose();
        return;
      }
      toast.error(describeApiError(error, "Failed to delete topic").message);
    }
  };

  return (
    <Dialog
      open={!!topic}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden border border-red-100 shadow-xl">
        <div className="p-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-semibold text-gray-900">
                Delete Topic Confirmation
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Are you sure you want to delete this topic? This action cannot be undone.
              </DialogDescription>
            </div>
          </div>

          {topic && (
            <div className="mt-4 space-y-3">
              <div className="bg-gray-50 border border-gray-200/80 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                    {topic.code}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">v{topic.version}</span>
                  <span className="text-[11px] text-gray-400">&bull;</span>
                  <span className="text-[11px] text-gray-500">{topic.technicalGroup || "General"}</span>
                </div>
                <p className="text-xs font-semibold text-gray-800 line-clamp-2">{topic.name}</p>
                <p className="text-[11px] text-gray-500">
                  Duration:{" "}
                  <span className="font-mono font-medium text-gray-700">
                    {topic.durationHours} hours
                  </span>
                </p>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-800">
                <ShieldAlert className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Integrity Guard:</strong> If this topic is currently referenced in any
                  training program or schedule, deletion will be blocked and you will be advised to
                  deactivate it instead.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="bg-gray-50/80 px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={onClose}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isDeleting}
            onClick={handleConfirmDelete}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-8 font-medium shadow-sm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" /> Delete Topic
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
