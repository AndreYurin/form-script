import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { mutations, type Project, type SearchConfig } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchConfigsConfigProps {
  project: Project;
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

function generateConfigId(): string {
  return `cfg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyConfig(): SearchConfig {
  return {
    id: generateConfigId(),
    name: "",
    searchKeywords: [],
    organizerFilters: [],
    amountFrom: null,
  };
}

interface TokenListProps {
  values: string[];
  placeholder: string;
  onChange: (next: string[]) => void;
}

function TokenList({ values, placeholder, onChange }: TokenListProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {values.length === 0 && (
        <p className="text-xs text-muted-foreground">— пусто —</p>
      )}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v, idx) => (
            <span
              key={`${v}-${idx}`}
              className="inline-flex items-center gap-1 text-xs border rounded px-2 py-0.5 bg-muted/30"
            >
              {v}
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(idx)}
                aria-label={`Удалить "${v}"`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!draft.trim()}>
          Добавить
        </Button>
      </div>
    </div>
  );
}

interface ConfigCardProps {
  config: SearchConfig;
  projectId: number;
  isDirty: boolean;
  isSaving: boolean;
  saveDisabled: boolean;
  onChange: (next: SearchConfig) => void;
  onRemove: () => void;
}

function ConfigCard({
  config,
  projectId,
  isDirty,
  isSaving,
  saveDisabled,
  onChange,
  onRemove,
}: ConfigCardProps) {
  const qc = useQueryClient();
  const [runError, setRunError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => mutations.runStep1ForConfig(projectId, config.id),
    onSuccess: () => {
      setRunError(null);
      qc.invalidateQueries({ queryKey: ["script-runs", projectId] });
      qc.invalidateQueries({ queryKey: ["notices", projectId] });
    },
    onError: (err) => setRunError(extractErrorMessage(err)),
  });

  const canRun =
    !isDirty &&
    config.searchKeywords.length > 0 &&
    !run.isPending &&
    !isSaving;

  const runTitle = isDirty
    ? "Сохраните изменения перед запуском"
    : config.searchKeywords.length === 0
      ? "Добавьте хотя бы одно ключевое слово"
      : undefined;

  return (
    <div className="border rounded-md p-3 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <Input
          className="h-8 text-sm flex-1"
          placeholder="Название конфигурации"
          value={config.name}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
        />
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          Удалить
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium mb-1">Ключевые слова для поиска</p>
          <TokenList
            values={config.searchKeywords}
            placeholder="Слово для поиска"
            onChange={(next) => onChange({ ...config, searchKeywords: next })}
          />
        </div>
        <div>
          <p className="text-xs font-medium mb-1">
            Фильтры по «Организатор» (содержит, без учёта регистра)
          </p>
          <TokenList
            values={config.organizerFilters}
            placeholder="Подстрока организатора"
            onChange={(next) => onChange({ ...config, organizerFilters: next })}
          />
          {config.organizerFilters.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Пусто — будут оставлены все строки из результата поиска.
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-1">«Сумма закупки с» (минимум, ₸)</p>
        <Input
          className="h-8 text-sm w-48"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder="например, 200000"
          value={config.amountFrom == null ? "" : String(config.amountFrom)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange({ ...config, amountFrom: null });
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) {
              onChange({ ...config, amountFrom: Math.floor(n) });
            }
          }}
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Пусто — без фильтра по минимальной сумме.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-xs text-muted-foreground truncate">
          ID: <code>{config.id}</code>
        </div>
        <div className="flex items-center gap-2">
          {runError && (
            <span className="text-xs text-destructive">{runError}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={!canRun || saveDisabled}
            title={runTitle}
            onClick={() => run.mutate()}
          >
            {run.isPending ? "Запускаю..." : "Запустить эту конфигурацию"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SearchConfigsConfig({ project }: SearchConfigsConfigProps) {
  const qc = useQueryClient();
  const [configs, setConfigs] = useState<SearchConfig[]>(project.searchConfigs);

  useEffect(() => {
    setConfigs(project.searchConfigs);
  }, [project.searchConfigs]);

  const save = useMutation({
    mutationFn: () => mutations.updateSearchConfigs(project.id, configs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
    },
  });

  const isDirty =
    JSON.stringify(configs) !== JSON.stringify(project.searchConfigs);

  const updateAt = (idx: number, next: SearchConfig) => {
    setConfigs(configs.map((c, i) => (i === idx ? next : c)));
  };

  const removeAt = (idx: number) => {
    setConfigs(configs.filter((_, i) => i !== idx));
  };

  const add = () => {
    setConfigs([...configs, emptyConfig()]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Конфигурации поиска</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={add}>
              + Добавить конфигурацию
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !isDirty}
            >
              {save.isPending ? "Сохраняю..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {configs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Пока нет ни одной конфигурации. Добавьте конфигурацию, указав
            ключевые слова для поиска и подстроки для фильтра по полю
            «Организатор».
          </p>
        )}

        {configs.map((cfg, idx) => (
          <ConfigCard
            key={cfg.id}
            config={cfg}
            projectId={project.id}
            isDirty={isDirty}
            isSaving={save.isPending}
            saveDisabled={save.isPending}
            onChange={(next) => updateAt(idx, next)}
            onRemove={() => removeAt(idx)}
          />
        ))}

        {save.isError && (
          <p className="text-xs text-destructive">
            Не удалось сохранить: {extractErrorMessage(save.error)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
