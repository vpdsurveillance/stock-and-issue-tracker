import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader, PageBody } from "./_shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Combobox, AutoInput } from "./_combo";
import { ConfirmDelete } from "./_confirm";
import { DEPARTMENTS, fmtDate } from "@/lib/utils-app";
import { useAuth } from "@/lib/auth";
import { Plus, X } from "lucide-react";

function todayISO() { return new Date().toISOString().slice(0, 10); }

const emptyLine = () => ({
  key: Math.random().toString(36).slice(2),
  item_id: "", item_name: "", pack_size: "",
  batch_key: "", // "{expiry}|{lot}"
  expiry_date: "", lot_number: "",
  quantity: "",
});

export default function IssuePage() {
  const { user } = useAuth();
  const [department, setDepartment] = useState("MDS");
  const [items, setItems] = useState([]);
  const [lots, setLots] = useState([]);
  const [issueDate, setIssueDate] = useState(todayISO());
  const [section, setSection] = useState("");
  const [program, setProgram] = useState("");
  const [sections, setSections] = useState([]);
  const [progs, setProgs] = useState([]);
  const [lines, setLines] = useState([emptyLine()]);

  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState("");
  const [progFilter, setProgFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");

  const load = async () => {
    const params = { department, search, from_date: from || undefined, to_date: to || undefined };
    if (progFilter !== "all") params.program = progFilter;
    if (sectionFilter !== "all") params.section = sectionFilter;
    const [it, cs, iss, sec, pg] = await Promise.all([
      api.get("/items", { params: { department } }),
      api.get("/reports/current-stock", { params: { department } }),
      api.get("/issues", { params }),
      api.get("/meta/sections"),
      api.get("/meta/programs"),
    ]);
    setItems(it.data); setLots(cs.data); setIssues(iss.data);
    setSections(sec.data); setProgs(pg.data);
  };

  useEffect(() => { load(); // eslint-disable-next-line
  }, [department, search, from, to, progFilter, sectionFilter]);

  const itemOpts = useMemo(
    () => items.map((i) => ({ value: i.id, label: i.name, meta: `Pack: ${i.pack_size}`, pack: i.pack_size, name: i.name })),
    [items]
  );

  const batchesFor = (line) => {
    if (!line.item_id) return [];
    const item = items.find((i) => i.id === line.item_id);
    if (!item) return [];
    return lots
      .filter((l) => l.item_name === item.name && l.pack_size === (line.pack_size || item.pack_size) && l.balance > 0)
      .map((l) => ({
        value: `${l.expiry_date}|${l.lot_number}`,
        label: `Lot ${l.lot_number || "—"} · exp ${fmtDate(l.expiry_date)}`,
        meta: `Balance: ${l.balance}`,
        expiry: l.expiry_date, lot: l.lot_number, balance: l.balance,
      }));
  };

  const updateLine = (key, patch) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const onItemPick = (key, val, opt) => {
    updateLine(key, {
      item_id: val, item_name: opt?.name || "",
      pack_size: opt?.pack || "",
      batch_key: "", expiry_date: "", lot_number: "",
    });
  };

  const onBatchPick = (key, val, opt) => {
    updateLine(key, { batch_key: val, expiry_date: opt?.expiry || "", lot_number: opt?.lot || "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!section.trim()) return toast.error("Enter issued section");
    const payload = [];
    for (const l of lines) {
      if (!l.item_id && !l.quantity) continue; // skip empty
      const item = items.find((it) => it.id === l.item_id);
      if (!item) return toast.error("Select item for every row");
      if (!l.expiry_date) return toast.error(`Select batch for ${item.name}`);
      const q = Number(l.quantity);
      if (!q || q <= 0) return toast.error(`Enter quantity for ${item.name}`);
      payload.push({
        item_id: item.id, department, item_name: item.name,
        pack_size: l.pack_size || item.pack_size,
        expiry_date: l.expiry_date, lot_number: l.lot_number,
        quantity: q, issued_section: section, issue_date: issueDate, program,
      });
    }
    if (!payload.length) return toast.error("Add at least one line");
    try {
      await api.post("/issues/batch", { items: payload });
      toast.success(`Issued ${payload.length} line(s)`);
      setLines([emptyLine()]);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const del = async (id) => {
    try { await api.delete(`/issues/${id}`); load(); toast.success("Deleted"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <>
      <PageHeader title="Issue" subtitle="Issue one or many items in a single transaction (lot / batch-wise)" />
      <PageBody>
        <Card className="p-5">
          <form onSubmit={submit} className="space-y-4">
            {/* Common fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger data-testid="is-department"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Issue date</Label>
                <Input data-testid="is-date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div>
                <Label>Issued section</Label>
                <AutoInput id="sec" testid="is-section" value={section} onChange={setSection} options={sections} placeholder="e.g. Molecular" />
              </div>
              <div>
                <Label>Program (optional)</Label>
                <AutoInput id="prg" testid="is-program" value={program} onChange={setProgram} options={progs} />
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-4">Item</div>
                <div className="col-span-2">Pack</div>
                <div className="col-span-3">Batch / Lot · Expiry</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-1"></div>
              </div>
              {lines.map((line, idx) => (
                <div key={line.key} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-slate-100 items-center">
                  <div className="col-span-4">
                    <Combobox
                      value={line.item_id}
                      onChange={(v, o) => onItemPick(line.key, v, o)}
                      options={itemOpts}
                      placeholder="Search item…"
                      testid={`is-item-${idx}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      data-testid={`is-pack-${idx}`}
                      value={line.pack_size}
                      onChange={(e) => updateLine(line.key, { pack_size: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Combobox
                      value={line.batch_key}
                      onChange={(v, o) => onBatchPick(line.key, v, o)}
                      options={batchesFor(line)}
                      placeholder={line.item_id ? (batchesFor(line).length ? "Select batch" : "No stock available") : "Pick item first"}
                      testid={`is-batch-${idx}`}
                      disabled={!line.item_id || batchesFor(line).length === 0}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      data-testid={`is-qty-${idx}`}
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-testid={`is-line-remove-${idx}`}
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-100 p-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={addLine}
                  data-testid="is-add-line"
                  className="gap-2 text-indigo-950"
                >
                  <Plus size={14} /> Add another item
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" data-testid="is-submit" className="bg-indigo-950 hover:bg-indigo-900">
                Record {lines.length > 1 ? `${lines.length} Issues` : "Issue"}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <Input placeholder="Search item…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="is-list-search" />
            <Select value={progFilter} onValueChange={setProgFilter}>
              <SelectTrigger className="w-44" data-testid="is-prog-filter"><SelectValue placeholder="All programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {progs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-44" data-testid="is-section-filter"><SelectValue placeholder="All sections" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              From <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
              To <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
            </div>
            <div className="ml-auto text-xs text-slate-500">{issues.length} issues</div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Date</th><th>Dept</th><th>Item</th><th>Pack</th><th>Lot</th><th>Expiry</th>
                  <th>Qty</th><th>Section</th><th>Program</th><th></th>
                </tr>
              </thead>
              <tbody data-testid="is-list-body">
                {issues.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.issue_date)}</td>
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td>{r.lot_number || "—"}</td>
                    <td>{fmtDate(r.expiry_date)}</td>
                    <td className="tabular-nums">{r.quantity}</td>
                    <td>{r.issued_section}</td>
                    <td>{r.program}</td>
                    <td>{user?.role === "admin" && (
                      <ConfirmDelete
                        testid={`is-del-${r.id}`}
                        title="Delete issue record?"
                        description={`${r.item_name} · Qty ${r.quantity}`}
                        onConfirm={() => del(r.id)}
                      />
                    )}</td>
                  </tr>
                ))}
                {issues.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-slate-400">No issues recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
