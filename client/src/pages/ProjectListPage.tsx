import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { queries } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProjectListPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: queries.listProjects,
  });

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Проекты</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="block">
            <Card className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge variant={p.cronEnabled ? "success" : "secondary"}>
                    {p.cronEnabled ? "cron on" : "cron off"}
                  </Badge>
                </div>
                <CardDescription>{p.description ?? "—"}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <div>Target: {p.targetUrl}</div>
                <div>Cron: <code>{p.cronExpression}</code></div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
