import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEPARTMENTS } from "@/lib/utils-app";

/**
 * Shared filter bar for reports.
 *  props: value = { department, program, search }, onChange(next)
 *  showDepartment / showProgram / showSearch toggles.
 */
export function FilterBar({ value, onChange, showDepartment = true, showProgram = true, showSearch = true, extras = null }) {
  const [progs, setProgs] = useState([]);
  useEffect(() => {
    if (!showProgram) return;
    api.get("/meta/programs").then((r) => setProgs(r.data));
  }, [showProgram]);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
      {showDepartment && (
        <Select value={value.department || "all"} onValueChange={(v) => set({ department: v })}>
          <SelectTrigger className="w-44" data-testid="fb-department"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {showProgram && (
        <Select value={value.program || "all"} onValueChange={(v) => set({ program: v })}>
          <SelectTrigger className="w-44" data-testid="fb-program"><SelectValue placeholder="All programs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {progs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {showSearch && (
        <Input
          placeholder="Search item…"
          className="max-w-xs"
          value={value.search || ""}
          onChange={(e) => set({ search: e.target.value })}
          data-testid="fb-search"
        />
      )}
      {extras}
    </div>
  );
}

/** Build query params from filter value, mapping 'all' → undefined. */
export function toParams(v = {}) {
  const p = {};
  if (v.department && v.department !== "all") p.department = v.department;
  if (v.program && v.program !== "all") p.program = v.program;
  if (v.search) p.search = v.search;
  return p;
}
