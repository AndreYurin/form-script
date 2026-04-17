import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mutations, type Project } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchKeywordsConfigProps {
  project: Project;
}

export function SearchKeywordsConfig({ project }: SearchKeywordsConfigProps) {
  const qc = useQueryClient();
  const [keywords, setKeywords] = useState<string[]>(project.searchKeywords);
  const [newKw, setNewKw] = useState("");

  const save = useMutation({
    mutationFn: () => mutations.updateKeywords(project.id, keywords),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
    },
  });

  const add = () => {
    const trimmed = newKw.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    setKeywords([...keywords, trimmed]);
    setNewKw("");
  };

  const remove = (idx: number) => {
    setKeywords(keywords.filter((_, i) => i !== idx));
  };

  const isDirty =
    JSON.stringify(keywords) !== JSON.stringify(project.searchKeywords);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ключевые слова поиска</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {keywords.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Нет ключевых слов. Добавьте хотя бы одно для запуска Step 1.
            </p>
          )}
          {keywords.map((kw, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex-1 text-sm border rounded px-3 py-1 bg-muted/30">
                {kw}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(idx)}
                aria-label={`Удалить "${kw}"`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            className="h-8 text-sm"
            placeholder="Новое ключевое слово"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="sm" variant="outline" onClick={add} disabled={!newKw.trim()}>
            Добавить
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => save.mutate()}
          disabled={save.isPending || !isDirty}
        >
          {save.isPending ? "Сохраняю..." : "Сохранить"}
        </Button>
      </CardContent>
    </Card>
  );
}
