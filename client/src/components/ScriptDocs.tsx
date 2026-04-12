import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

const SCRIPT_ENTRIES = [
  {
    name: "step1",
    title: "Step 1 — сбор объявлений",
    description: "Парсит страницу поиска и фильтрует объявления по ключевым словам организатора.",
  },
  {
    name: "step2",
    title: "Step 2 — детали объявления",
    description: "Открывает страницу объявления и извлекает все поля в results.json.",
  },
];

export function ScriptDocs({ projectId }: { projectId: number }) {
  const { data: runs = [] } = useQuery({
    queryKey: ["script-runs", projectId],
    queryFn: () => queries.listScriptRuns(projectId, 50),
    refetchInterval: 5_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Скрипты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SCRIPT_ENTRIES.map((entry) => {
          const last = runs.find((r) => r.scriptName === entry.name);
          return (
            <div key={entry.name} className="flex justify-between items-start border-b last:border-0 pb-3 last:pb-0">
              <div className="space-y-1">
                <div className="font-medium">{entry.title}</div>
                <div className="text-xs text-muted-foreground">{entry.description}</div>
              </div>
              <div className="text-right space-y-1">
                {last ? (
                  <>
                    <StatusBadge status={last.status} />
                    <div className="text-xs text-muted-foreground">{formatDateTime(last.startedAt)}</div>
                  </>
                ) : (
                  <Badge variant="outline">нет запусков</Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">success</Badge>;
  if (status === "running") return <Badge variant="secondary">running</Badge>;
  return <Badge variant="destructive">error</Badge>;
}
