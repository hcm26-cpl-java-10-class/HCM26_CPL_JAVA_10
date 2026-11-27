import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { TopicItem } from "@/types/features/content";
import { TopicDetailContent } from "./TopicDetailContent";

interface TopicDetailModalProps {
  topic: TopicItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (topic: TopicItem) => void;
}

export function TopicDetailModal({ topic, open, onOpenChange, onEdit }: TopicDetailModalProps) {
  const { canAccessResource } = usePermissions();
  const canUpdate = canAccessResource("SUBJECT", "UPDATE");

  if (!topic) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl md:max-w-5xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-800">Topic Detail</DialogTitle>
          </DialogHeader>
          {onEdit && canUpdate && (
            <Button
              type="button"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                onOpenChange(false);
                onEdit(topic);
              }}
            >
              Edit Topic
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5">
          <TopicDetailContent topic={topic} canUpdate={canUpdate} compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}

