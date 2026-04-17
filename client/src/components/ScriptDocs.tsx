import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queries, type ScriptRun } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 50;

function durationLabel(run: ScriptRun): string {
  if (!run.finishedAt) return "...";
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">success</Badge>;
  if (status === "running") return <Badge variant="secondary">running</Badge>;
  return <Badge variant="destructive">error</Badge>;
}

export function ScriptDocs({ projectId }: { projectId: number }) {
  const [offset, setOffset] = useState(0);
  const [allRuns, setAllRuns] = useState<ScriptRun[]>([]);
  const [screenshotRun, setScreenshotRun] = useState<ScriptRun | null>(null);

  const { data } = useQuery({
    queryKey: ["script-runs", projectId, offset],
    queryFn: async () => {
      const result = await queries.listScriptRuns(projectId, PAGE_SIZE, offset);
      if (offset === 0) {
        setAllRuns(result.runs);
      } else {
        setAllRuns((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          const next = result.runs.filter((r) => !ids.has(r.id));
          return [...prev, ...next];
        });
      }
      return result;
    },
    refetchInterval: offset === 0 ? 5_000 : undefined,
  });

  const total = data?.total ?? 0;
  const hasMore = allRuns.length < total;

  const loadMore = () => {
    setOffset(allRuns.length);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>История запусков</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 w-16">ID</th>
                <th className="px-4 py-2">Скрипт</th>
                <th className="px-4 py-2 w-28">Статус</th>
                <th className="px-4 py-2 w-40">Начало</th>
                <th className="px-4 py-2 w-24">Длит.</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {allRuns.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.id}</td>
                  <td className="px-4 py-2">{r.scriptName}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {formatDateTime(r.startedAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {durationLabel(r)}
                  </td>
                  <td className="px-4 py-2">
                    {r.screenshotPath && (
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setScreenshotRun(r)}
                        title="Просмотр скриншота"
                        aria-label="Просмотр скриншота"
                      >
                        📷
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {allRuns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Нет запусков.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {hasMore && (
            <div className="p-3 border-t">
              <Button size="sm" variant="outline" onClick={loadMore} className="w-full">
                Загрузить ещё ({allRuns.length} / {total})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {screenshotRun && (
        <Dialog open onOpenChange={() => setScreenshotRun(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Скриншот — запуск #{screenshotRun.id} ({formatDateTime(screenshotRun.startedAt)})
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[70vh]">
              <img
                src={`/data/${screenshotRun.screenshotPath}`}
                alt={`Screenshot run ${screenshotRun.id}`}
                className="w-full rounded border"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
