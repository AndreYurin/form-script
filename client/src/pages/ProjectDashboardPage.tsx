import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { mutations, queries } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CronConfig } from "@/components/CronConfig";
import { AuthSection } from "@/components/AuthSection";
import { SearchKeywordsConfig } from "@/components/SearchKeywordsConfig";
import { ScriptDocs } from "@/components/ScriptDocs";
import { NoticeTable } from "@/components/NoticeTable";

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

export function ProjectDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => queries.getProject(projectId),
    enabled: Number.isFinite(projectId),
  });

  const stopAllMutation = useMutation({
    mutationFn: () => mutations.stopAll(projectId),
    onSuccess: (result) => {
      window.alert(
        `Cron отключён. Остановлено запусков: ${result.cancelledRuns} из ${result.totalRunning}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["script-runs", projectId] });
    },
    onError: (err) => {
      window.alert(`Не удалось остановить: ${extractErrorMessage(err)}`);
    },
  });

  if (isLoading || !project) return <div>Загрузка...</div>;

  const confirmStopAll = () => {
    if (
      window.confirm(
        "Отключить cron и остановить все текущие запуски этого проекта? Будущие запуски выполняться не будут, пока cron не включат снова.",
      )
    ) {
      stopAllMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Button
          variant="destructive"
          onClick={confirmStopAll}
          disabled={stopAllMutation.isPending}
        >
          {stopAllMutation.isPending ? "Остановка..." : "Stop All"}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CronConfig project={project} />
        <AuthSection projectId={project.id} />
      </div>

      <SearchKeywordsConfig project={project} />

      <ScriptDocs projectId={project.id} />
      <NoticeTable projectId={project.id} hasKeywords={(project.searchKeywords?.length ?? 0) > 0} />
    </div>
  );
}
