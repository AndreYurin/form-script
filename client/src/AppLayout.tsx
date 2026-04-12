import { Outlet, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: queries.listProjects,
  });

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-muted/20 p-4 flex flex-col gap-2">
        <h1 className="text-lg font-semibold mb-4">form-script</h1>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "rounded px-3 py-2 text-sm hover:bg-accent",
              isActive && "bg-accent font-medium",
            )
          }
        >
          Все проекты
        </NavLink>
        <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground px-3">
          Проекты
        </div>
        {projects.map((p) => (
          <NavLink
            key={p.id}
            to={`/projects/${p.id}`}
            className={({ isActive }) =>
              cn(
                "rounded px-3 py-2 text-sm hover:bg-accent truncate",
                isActive && "bg-accent font-medium",
              )
            }
          >
            {p.name}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
