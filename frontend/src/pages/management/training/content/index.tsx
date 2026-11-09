import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { TopicList } from "./components/TopicList";
import { ProgramList } from "./components/ProgramList";
import { ProgramBuilder } from "./components/ProgramBuilder";
import { ProgramDetailView } from "./components/ProgramDetailView";
import { TopicDetailView } from "./components/TopicDetailView";
import type { TrainingProgramItem, TopicItem } from "@/types/features/content";
import { topicApi } from "@/api/features/topic.api";
import { toast } from "sonner";

type ContentView =
  | "topic-list"
  | "topic-detail"
  | "program-list"
  | "program-detail"
  | "program-builder";

export default function ContentPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const defaultView: ContentView =
    location.pathname.includes("/subjects") ||
    location.pathname.includes("/content") ||
    searchParams.get("tab") === "topic"
      ? "topic-list"
      : "program-list";

  const [view, setView] = useState<ContentView>(defaultView);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgramItem | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicItem | null>(null);
  const [editingProgram, setEditingProgram] = useState<TrainingProgramItem | null>(null);

  useEffect(() => {
    if (location.pathname.includes("/subjects") || location.pathname.includes("/content")) {
      setView("topic-list");
    } else if (location.pathname.includes("/programs")) {
      setView("program-list");
    }
  }, [location.pathname]);

  const handleOpenCreate = () => {
    setEditingProgram(null);
    setView("program-builder");
  };

  const handleEditProgram = (prog: TrainingProgramItem) => {
    setEditingProgram(prog);
    setView("program-builder");
  };

  const handleBackFromBuilder = () => {
    if (selectedProgram) {
      setView("program-detail");
    } else {
      setView("program-list");
    }
    setEditingProgram(null);
  };

  return (
    <MainLayout pathName={{ training: "Training Operations", content: "Content" }}>
      <div className="flex-1 flex flex-col space-y-4">
        {/* Sub-navigation bar (FAMS style) - visible on list views */}
        {(view === "topic-list" || view === "program-list") && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 flex items-center shadow-sm">
            <button
              onClick={() => {
                setView("topic-list");
                setSelectedTopic(null);
              }}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                view === "topic-list"
                  ? "border-[#5b52e0] text-[#5b52e0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Syllabus / Topic
            </button>
            <button
              onClick={() => {
                setView("program-list");
                setSelectedProgram(null);
                setEditingProgram(null);
              }}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                view === "program-list"
                  ? "border-[#5b52e0] text-[#5b52e0]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Training Program
            </button>
          </div>
        )}

        {/* View content container */}
        <div className="flex-1">
          {view === "topic-list" && (
            <TopicList
              onViewDetail={(topic) => {
                setSelectedTopic(topic);
                setView("topic-detail");
              }}
            />
          )}

          {view === "topic-detail" && selectedTopic && (
            <TopicDetailView
              topic={selectedTopic}
              onBack={() => {
                if (selectedProgram) {
                  setView("program-detail");
                } else {
                  setView("topic-list");
                }
              }}
              onEdit={() => {
                toast.info("Please edit topic from the topic list");
              }}
            />
          )}

          {view === "program-list" && (
            <ProgramList
              onOpenCreate={handleOpenCreate}
              onEditProgram={handleEditProgram}
              onViewDetail={(program) => {
                setSelectedProgram(program);
                setView("program-detail");
              }}
            />
          )}

          {view === "program-detail" && selectedProgram && (
            <ProgramDetailView
              program={selectedProgram}
              onBack={() => {
                setView("program-list");
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

          {view === "program-builder" && (
            <ProgramBuilder
              initialProgram={editingProgram}
              onBack={handleBackFromBuilder}
              onSaved={() => {
                setView("program-list");
                setEditingProgram(null);
                setSelectedProgram(null);
              }}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
