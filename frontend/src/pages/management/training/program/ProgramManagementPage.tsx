import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProgramList } from "../content/components/ProgramList";
import { ProgramDetailView } from "../content/components/ProgramDetailView";
import { ProgramBuilder } from "../content/components/ProgramBuilder";
import { TopicDetailView } from "../content/components/TopicDetailView";
import type { TrainingProgramItem, TopicItem } from "@/types/features/content";
import { topicApi } from "@/api/features/topic.api";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <MainLayout pathName={{ training: "Training Management", content: "Training Programs" }}>
      <div className="flex-1 flex flex-col space-y-4">
        {/* Page Title Header under Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-gray-200/80 gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-50 border border-purple-100/80 flex items-center justify-center text-[#5b52e0] shadow-sm shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {view === "detail" && selectedProgram
                    ? selectedProgram.name
                    : view === "builder"
                    ? editingProgram
                      ? `Edit Program: ${editingProgram.name}`
                      : "Create Training Program"
                    : view === "topic-detail" && selectedTopic
                    ? `Topic: ${selectedTopic.name}`
                    : "Training Programs"}
                </h1>
                <Badge variant="outline" className="text-[11px] font-semibold bg-purple-50/60 text-[#5b52e0] border-purple-200">
                  {view === "builder" ? "Program Builder" : view === "detail" ? "Program Details" : "Training Tracks"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {view === "detail" && selectedProgram
                  ? `Khung chương trình đào tạo mã ${selectedProgram.code} (Phiên bản ${selectedProgram.version || "1.0"})`
                  : view === "builder"
                  ? "Thiết lập cấu trúc chương trình đào tạo, khu vực áp dụng và ánh xạ danh sách môn học"
                  : "Quản lý khung chương trình đào tạo chuyên biệt, quản lý phiên bản và cấu trúc môn học trực thuộc"}
              </p>
            </div>
          </div>
        </div>

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

