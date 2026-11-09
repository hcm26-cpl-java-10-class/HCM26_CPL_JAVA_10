import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProgramList } from "../content/components/ProgramList";
import { ProgramDetailView } from "../content/components/ProgramDetailView";
import { ProgramBuilder } from "../content/components/ProgramBuilder";
import { TopicDetailView } from "../content/components/TopicDetailView";
import type { TrainingProgramItem, TopicItem } from "@/types/features/content";
import { topicApi } from "@/api/features/topic.api";
import { toast } from "sonner";

type ProgramView = "list" | "detail" | "builder" | "topic-detail";

export default function ProgramManagementPage() {
  const [view, setView] = useState<ProgramView>("list");
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgramItem | null>(null);
  const [editingProgram, setEditingProgram] = useState<TrainingProgramItem | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null);

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setView("builder");
  };

  const handleEditProgram = (prog: TrainingProgramItem) => {
    setEditingProgram(prog);
    setView("builder");
  };

  const handleBackFromBuilder = () => {
    if (selectedProgram) {
      setView("detail");
    } else {
      setView("list");
    }
    setEditingProgram(null);
  };

  return (
    <MainLayout pathName={{ training: "Training Operations", content: "Training Programs" }}>
      <div className="flex-1 flex flex-col space-y-4">
        {view === "list" && (
          <ProgramList
            onOpenCreate={handleOpenCreate}
            onEditProgram={handleEditProgram}
            onViewDetail={(program) => {
              setSelectedProgram(program);
              setView("detail");
            }}
          />
        )}

        {view === "detail" && selectedProgram && (
          <ProgramDetailView
            program={selectedProgram}
            onBack={() => {
              setView("list");
              setSelectedProgram(null);
            }}
            onEdit={handleEditProgram}
            onSelectTopic={async (topicId) => {
              try {
                const t = await topicApi.getById(topicId);
                setSelectedTopic(t);
                setView("topic-detail");
              } catch {
                toast.error("Cannot load topic detail");
              }
            }}
          />
        )}

        {view === "topic-detail" && selectedTopic && (
          <TopicDetailView
            topic={selectedTopic}
            onBack={() => {
              setView("detail");
              setSelectedTopic(null);
            }}
            onEdit={() => {
              toast.info("Please edit topic from the topic list");
            }}
          />
        )}

        {view === "builder" && (
          <ProgramBuilder
            initialProgram={editingProgram}
            onBack={handleBackFromBuilder}
            onSaved={() => {
              setView("list");
              setEditingProgram(null);
              setSelectedProgram(null);
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
