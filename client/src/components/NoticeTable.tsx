import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queries, mutations, type Notice, type NoticeStatus } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

interface NoticeSummary {
  amount: string | null;
  endDate: string | null;
  url: string | null;
}

function extractNoticeSummary(notice: Notice): NoticeSummary {
  const details = notice.details;
  if (!details || typeof details !== "object") {
    return { amount: null, endDate: null, url: null };
  }

  const readString = (key: string): string | null => {
    const value = (details as Record<string, unknown>)[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    amount: readString("amount"),
    endDate: readString("endDate"),
    url: readString("url"),
  };
}

function noticeIdToFallbackUrl(noticeId: string): string {
  const numericPart = noticeId.split("-")[0];
  return `https://goszakup.gov.kz/ru/announce/index/${numericPart}`;
}

export function NoticeTable({ projectId, hasKeywords }: { projectId: number; hasKeywords: boolean }) {
  const qc = useQueryClient();
  const page = 1;
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
                disabled={runStep1.isPending || !hasKeywords}
                title={!hasKeywords ? "Добавьте ключевые слова поиска перед запуском" : undefined}
              >
                {runStep1.isPending ? "Запускаю..." : "Запустить Step 1"}
              </Button>
              <Button
                size="sm"
                onClick={() => bulk.mutate()}
                disabled={bulk.isPending || !hasNew}
              >
                {bulk.isPending ? "Собираю..." : "Собрать информацию для всех"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 w-32">Номер</th>
                <th className="px-4 py-2">Название</th>
                <th className="px-4 py-2">Организатор</th>
                <th className="px-4 py-2 w-40">Сумма</th>
                <th className="px-4 py-2 w-44">Дата завершения</th>
                <th className="px-4 py-2 w-64 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const summary = extractNoticeSummary(r);
                const href = summary.url ?? noticeIdToFallbackUrl(r.noticeId);
                const fillDisabled =
                  r.status === "rejected" ||
                  r.status === "details_collected" ||
                  collect.isPending;
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30 align-top">
                    <td className="px-4 py-2 font-mono text-xs break-words">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2 hover:no-underline"
                      >
                        {r.noticeId}
                      </a>
                    </td>
                    <td className="px-4 py-2 break-words">
                      <button
                        className="text-left underline hover:no-underline"
                        onClick={() => setSelected(r)}
                      >
                        {r.title ?? "(без названия)"}
                      </button>
                    </td>
                    <td className="px-4 py-2 break-words">{r.organizer ?? "—"}</td>
                    <td className="px-4 py-2 break-words">{summary.amount ?? "—"}</td>
                    <td className="px-4 py-2 break-words">{summary.endDate ?? "—"}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fillDisabled}
                          onClick={() => collect.mutate(r.id)}
                        >
                          Заполнить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={r.status === "rejected"}
                          onClick={() => reject.mutate(r.id)}
                        >
                          Не подходит
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Подробнее">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuLabel>Метаданные</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="flex-col items-start gap-1"
                            >
                              <span className="text-xs text-muted-foreground">Статус</span>
                              <Badge variant={STATUS_VARIANT[r.status]}>
                                {STATUS_LABEL[r.status]}
                              </Badge>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="flex-col items-start gap-1"
                            >
                              <span className="text-xs text-muted-foreground">Собрано</span>
                              <span className="text-sm">{formatDateTime(r.collectedAt)}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="flex-col items-start gap-1"
                            >
                              <span className="text-xs text-muted-foreground">Ключевое слово</span>
                              <span className="text-sm">{r.searchKeyword ?? "—"}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
