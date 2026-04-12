import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queries, mutations, type Notice, type NoticeStatus } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { NoticeDetail } from "./NoticeDetail";

const STATUS_VARIANT: Record<NoticeStatus, "default" | "success" | "secondary" | "destructive"> = {
  new: "default",
  details_collected: "success",
  rejected: "secondary",
  error: "destructive",
};

const STATUS_LABEL: Record<NoticeStatus, string> = {
  new: "новое",
  details_collected: "собрано",
  rejected: "отклонено",
  error: "ошибка",
};

export function NoticeTable({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Notice | null>(null);

  const { data } = useQuery({
    queryKey: ["notices", projectId, page],
    queryFn: () => queries.listNotices(projectId, { page, pageSize: 50 }),
    refetchInterval: 5_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notices", projectId] });
    qc.invalidateQueries({ queryKey: ["script-runs", projectId] });
  };

  const runStep1 = useMutation({
    mutationFn: () => mutations.runStep1(projectId),
    onSuccess: invalidate,
  });

  const bulk = useMutation({
    mutationFn: () => mutations.bulkCollect(projectId),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (noticeRowId: number) => mutations.rejectNotice(projectId, noticeRowId),
    onMutate: async (noticeRowId) => {
      await qc.cancelQueries({ queryKey: ["notices", projectId] });
      const prev = qc.getQueryData<any>(["notices", projectId, page]);
      if (prev) {
        qc.setQueryData(["notices", projectId, page], {
          ...prev,
          rows: prev.rows.map((r: Notice) =>
            r.id === noticeRowId ? { ...r, status: "rejected" } : r,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notices", projectId, page], ctx.prev);
    },
    onSettled: invalidate,
  });

  const collect = useMutation({
    mutationFn: (noticeRowId: number) => mutations.collectNotice(projectId, noticeRowId),
    onSuccess: invalidate,
  });

  const rows = data?.rows ?? [];
  const hasNew = rows.some((r) => r.status === "new");

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Объявления ({data?.total ?? 0})</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runStep1.mutate()}
                disabled={runStep1.isPending}
              >
                {runStep1.isPending ? "Запускаю..." : "Запустить Step 1"}
              </Button>
              <Button
                size="sm"
                onClick={() => bulk.mutate()}
                disabled={bulk.isPending || !hasNew}
              >
                {bulk.isPending ? "Собираю..." : "Собрать для всех"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 w-32">ID</th>
                <th className="px-4 py-2">Организатор</th>
                <th className="px-4 py-2">Название</th>
                <th className="px-4 py-2 w-32">Статус</th>
                <th className="px-4 py-2 w-40">Собрано</th>
                <th className="px-4 py-2 w-60 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const disabled = r.status === "rejected" || r.status === "details_collected";
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{r.noticeId}</td>
                    <td className="px-4 py-2 truncate max-w-[240px]">{r.organizer ?? "—"}</td>
                    <td className="px-4 py-2 truncate max-w-[320px]">
                      <button className="underline hover:no-underline" onClick={() => setSelected(r)}>
                        {r.title ?? "(без названия)"}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {formatDateTime(r.collectedAt)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled || collect.isPending}
                          onClick={() => collect.mutate(r.id)}
                        >
                          Собрать
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={r.status === "rejected"}
                          onClick={() => reject.mutate(r.id)}
                        >
                          Не подходит
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Пусто. Запустите Step 1, чтобы собрать объявления.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <NoticeDetail notice={selected} onClose={() => setSelected(null)} />
    </>
  );
}
