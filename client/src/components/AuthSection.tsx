import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queries, mutations } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AuthSection({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["auth-status", projectId],
    queryFn: () => queries.authStatus(projectId),
    refetchInterval: 3_000,
  });

  const start = useMutation({
    mutationFn: () => mutations.startAuth(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-status", projectId] }),
  });

  const stop = useMutation({
    mutationFn: () => mutations.stopAuth(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-status", projectId] }),
  });

  const badge = status?.authorized ? (
    <Badge variant="success">Авторизован</Badge>
  ) : (
    <Badge variant="warning">Нет сессии</Badge>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Авторизация {badge}
          {status?.inProgress && <Badge variant="secondary">окно открыто</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button
          onClick={() => start.mutate()}
          disabled={start.isPending || status?.inProgress}
        >
          Авторизоваться
        </Button>
        {status?.inProgress && (
          <Button variant="outline" onClick={() => stop.mutate()}>
            Закрыть окно
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
