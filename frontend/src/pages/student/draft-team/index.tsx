import { projectTemplateApi, teamAllocationApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ProjectTemplateOption,
  TeamProjectTemplate,
  TeamTemplateApiError,
} from "@/types/features/team-allocation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, ClipboardList, LoaderCircle, Save, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * US-10 — Student (Team Leader) view.
 * <p>
 * Route: `/student/draft-team`. Lists the DRAFT teams the signed-in student
 * leads (team role `PM`) and lets them pick the official project template for
 * the team. The capacity window (`min_members`..`max_members`) is enforced by
 * the backend; violations come back as HTTP 400
 * `ERR_TEAM_CAPACITY_EXCEEDED` and are rendered per team.
 */
function getTemplateFailure(error: unknown): TeamTemplateApiError {
  if (axios.isAxiosError<TeamTemplateApiError>(error)) {
    const data = error.response?.data;
    return {
      status: error.response?.status ?? 0,
      errorCode: data?.errorCode ?? "ERR_REQUEST_FAILED",
      reason: data?.reason ?? null,
      message: data?.message ?? error.message ?? "Không thể gán đề bài. Vui lòng thử lại.",
      teamId: data?.teamId ?? null,
      projectTemplateId: data?.projectTemplateId ?? null,
      projectTemplateName: data?.projectTemplateName ?? null,
      memberCount: data?.memberCount ?? null,
      minMembers: data?.minMembers ?? null,
      maxMembers: data?.maxMembers ?? null,
    };
  }

  return {
    status: 0,
    errorCode: "ERR_REQUEST_FAILED",
    message: error instanceof Error
      ? error.message
      : "Không thể gán đề bài. Vui lòng thử lại.",
  };
}

export default function StudentDraftTeamPage() {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Record<number, string>>({});
  const [failures, setFailures] = useState<Record<number, TeamTemplateApiError>>({});

  const teamsQuery = useQuery({
    queryKey: ["student", "draft-teams"],
    queryFn: () => teamAllocationApi.getMyDraftTeams(),
  });
  const templatesQuery = useQuery({
    queryKey: ["project-templates", "options"],
    queryFn: () => projectTemplateApi.getOptions(),
  });

  const assignMutation = useMutation({
    mutationFn: ({
      teamId,
      projectTemplateId,
    }: {
      teamId: number;
      projectTemplateId: number;
    }) => teamAllocationApi.assignMyDraftTeamTemplate(teamId, projectTemplateId),
    onSuccess: async (updated) => {
      setFailures((current) => {
        const next = { ...current };
        delete next[updated.teamId];
        return next;
      });
      setSelection((current) => {
        const next = { ...current };
        delete next[updated.teamId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["student", "draft-teams"] });
      toast.success(
        `Đã gán đề bài “${updated.projectTemplateName ?? "đề bài"}” cho nhóm ${updated.teamName}.`,
      );
    },
    onError: (error, variables) => {
      const failure = getTemplateFailure(error);
      setFailures((current) => ({ ...current, [variables.teamId]: failure }));
      toast.error(failure.message ?? "Không thể gán đề bài.");
    },
  });

  const templates = templatesQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  return (
    <MainLayout pathName={{ student: "Sinh viên", "draft-team": "Nhóm nháp của tôi" }}>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-8 text-white sm:px-9 sm:py-10">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <Badge className="mb-4 border border-white/20 bg-white/10 text-blue-100 hover:bg-white/10">
                TRƯỞNG NHÓM
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Gán đề bài cho nhóm nháp
              </h1>
              <p className="mt-3 text-sm leading-6 text-blue-100/80 sm:text-base">
                Chọn Project Template chính thức cho nhóm đang ở trạng thái DRAFT.
                Hệ thống kiểm tra sĩ số nhóm so với khoảng tối thiểu – tối đa của đề bài
                trước khi lưu.
              </p>
            </div>
            <div className="hidden size-24 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 sm:flex">
              <UsersRound className="size-12 text-blue-100" />
            </div>
          </div>
        </section>

        {teamsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải nhóm nháp...
          </div>
        ) : teamsQuery.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Không tải được danh sách nhóm nháp của bạn.
            <Button
              className="ml-3"
              size="sm"
              variant="outline"
              onClick={() => void teamsQuery.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="mx-auto size-9 text-muted-foreground" />
              <p className="mt-3 font-medium">Bạn chưa có nhóm nháp nào</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bạn chỉ thấy nhóm ở trạng thái DRAFT mà bạn là Trưởng nhóm (vai trò PM).
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <DraftTeamTemplateCard
                key={team.teamId}
                team={team}
                templates={templates}
                templatesLoading={templatesQuery.isLoading}
                selection={selection[team.teamId] ?? ""}
                onSelect={(value) => {
                  setSelection((current) => ({ ...current, [team.teamId]: value }));
                  setFailures((current) => {
                    const next = { ...current };
                    delete next[team.teamId];
                    return next;
                  });
                }}
                failure={failures[team.teamId]}
                pending={
                  assignMutation.isPending &&
                  assignMutation.variables?.teamId === team.teamId
                }
                onAssign={(projectTemplateId) =>
                  assignMutation.mutate({ teamId: team.teamId, projectTemplateId })
                }
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function DraftTeamTemplateCard({
  team,
  templates,
  templatesLoading,
  selection,
  onSelect,
  failure,
  pending,
  onAssign,
}: {
  team: TeamProjectTemplate;
  templates: ProjectTemplateOption[];
  templatesLoading: boolean;
  selection: string;
  onSelect: (value: string) => void;
  failure?: TeamTemplateApiError;
  pending: boolean;
  onAssign: (projectTemplateId: number) => void;
}) {
  const currentTemplateId =
    team.projectTemplateId == null ? "" : String(team.projectTemplateId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {team.teamName}
              <Badge variant="secondary">{team.teamStatus}</Badge>
            </CardTitle>
            <CardDescription>
              {team.className ?? `Lớp #${team.classId ?? "?"}`} · {team.memberCount} thành viên
            </CardDescription>
          </div>
          <Badge variant={team.projectTemplateId ? "default" : "outline"}>
            {team.projectTemplateId ? "Đã gán đề bài" : "Chưa gán đề bài"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium">
          {team.projectTemplateName ?? "Chưa có đề bài"}
        </p>
        <p className="text-xs text-muted-foreground">
          Sĩ số hiện tại: {team.memberCount} thành viên
          {team.minMembers != null && team.maxMembers != null
            ? ` · Đề bài hiện tại yêu cầu ${team.minMembers}–${team.maxMembers} thành viên`
            : ""}
        </p>

        {failure && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertCircle className="size-4" />
              {failure.errorCode === "ERR_TEAM_NOT_DRAFT"
                ? "Nhóm không còn ở trạng thái DRAFT"
                : failure.reason === "MIN_MEMBERS_NOT_MET"
                  ? "Nhóm chưa đủ sĩ số tối thiểu"
                  : "Sĩ số nhóm vượt quá sức chứa của đề bài"}
            </p>
            <p className="mt-1 text-muted-foreground">{failure.message}</p>
            {failure.minMembers != null && failure.maxMembers != null && (
              <p className="mt-1 text-muted-foreground">
                Yêu cầu {failure.minMembers}–{failure.maxMembers} thành viên · hiện có{" "}
                {failure.memberCount ?? 0}.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <select
            aria-label={`Chọn đề bài cho ${team.teamName}`}
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            value={selection}
            disabled={pending || templatesLoading}
            onChange={(event) => onSelect(event.target.value)}
          >
            <option value="">
              {templatesLoading ? "Đang tải đề bài..." : "Chọn đề bài"}
            </option>
            {templates.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.minMembers}–{option.maxMembers} thành viên)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={pending || !selection || selection === currentTemplateId}
            onClick={() => onAssign(Number(selection))}
          >
            {pending
              ? <LoaderCircle className="size-4 animate-spin" />
              : <Save className="size-4" />}
            Gán đề bài
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
