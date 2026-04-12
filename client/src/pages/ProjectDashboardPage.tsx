import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api";
import { CronConfig } from "@/components/CronConfig";
import { AuthSection } from "@/components/AuthSection";
import { ScriptDocs } from "@/components/ScriptDocs";
import { NoticeTable } from "@/components/NoticeTable";

export function ProjectDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => queries.getProject(projectId),
    enabled: Number.isFinite(projectId),
  });

  if (isLoading || !project) return <div>Загрузка...</div>;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CronConfig project={project} />
        <AuthSection projectId={project.id} />
      </div>

      <ScriptDocs projectId={project.id} />
      <NoticeTable projectId={project.id} />
    </div>
  );
}
