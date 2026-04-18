import type { Notice } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  notice: Notice | null;
  onClose: () => void;
}

const DETAIL_LABELS: Record<string, string> = {
  id: "Номер",
  number: "Номер",
  organizer: "Организатор",
  amount: "Сумма",
  endDate: "Дата завершения",
  url: "Ссылка",
  title: "Название",
};

function labelFor(key: string): string {
  return DETAIL_LABELS[key] ?? key;
}

export function NoticeDetail({ notice, onClose }: Props) {
  if (!notice) return null;
  const entries = Object.entries(notice.details ?? {});

  return (
    <Dialog open={!!notice} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="block break-words">{notice.title ?? notice.noticeId}</span>
            <span className="block text-sm font-normal text-muted-foreground">
              Номер: {notice.noticeId}
            </span>
          </DialogTitle>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет собранных данных.</p>
        ) : (
          <div className="space-y-3">
            {entries.map(([k, v]) => (
              <div key={k} className="border-b last:border-0 pb-2 last:pb-0">
                <div className="text-xs tracking-wider text-muted-foreground">{labelFor(k)}</div>
                <div className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">
                  {typeof v === "string" ? v : JSON.stringify(v, null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
