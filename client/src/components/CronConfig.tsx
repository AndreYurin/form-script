import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutations, type ProjectDetail } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function humanize(expr: string): string {
  const map: Record<string, string> = {
    "0 6 * * *": "каждый день в 06:00",
    "0 */6 * * *": "каждые 6 часов",
    "*/30 * * * *": "каждые 30 минут",
  };
  return map[expr] ?? expr;
}

export function CronConfig({ project }: { project: ProjectDetail }) {
  const qc = useQueryClient();
  const [expr, setExpr] = useState(project.cronExpression);
  const [enabled, setEnabled] = useState(project.cronEnabled);

  useEffect(() => {
    setExpr(project.cronExpression);
    setEnabled(project.cronEnabled);
  }, [project.cronExpression, project.cronEnabled]);

  const save = useMutation({
    mutationFn: () =>
      mutations.updateCron(project.id, { cronExpression: expr, cronEnabled: enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Расписание (cron)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Input value={expr} onChange={(e) => setExpr(e.target.value)} className="font-mono" />
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm">{enabled ? "вкл" : "выкл"}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{humanize(expr)}</p>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Сохраняю..." : "Сохранить"}
        </Button>
      </CardContent>
    </Card>
  );
}
