import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TopicList } from "../content/components/TopicList";
import { TopicDetailView } from "../content/components/TopicDetailView";
import type { TopicItem } from "@/types/features/content";
import { toast } from "sonner";

export default function TopicManagementPage() {
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null);

  return (
    <MainLayout pathName={{ training: "Training Operations", content: "Topics & Syllabus" }}>
      <div className="flex-1 flex flex-col space-y-4">
        {selectedTopic ? (
          <TopicDetailView
            topic={selectedTopic}
            onBack={() => setSelectedTopic(null)}
            onEdit={() => {
              toast.info("Please edit topic from the topic list");
            }}
          />
        ) : (
          <TopicList
            onViewDetail={(topic) => {
              setSelectedTopic(topic);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}

