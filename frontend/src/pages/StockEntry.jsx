import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader, PageBody } from "./_shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Combobox, AutoInput } from "./_combo";
import { DEPARTMENTS, fmtDate } from "@/lib/utils-app";
import { ConfirmDelete } from "./_confirm";
import { useAuth } from "@/lib/auth";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function StockEntry() {
  const { user } = useAuth();
  const [department, setDepartment] = useState("MDS");
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [packSize, setPackSize] = useState("");
  const [qty, setQty] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayISO());
  const [lotNumber, setLotNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [supplier, setSupplier] = useState("");
  const [program, setProgram] = useState("");
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ manufacturers: [], suppliers: [], programs: [] });
  const [search, setSearch] = useState("");
  const [progFilter, setProgFilter] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");

  const loadItems = useCallback(async (dept) => {
    const { data } = await api.get("/items", { params: { department: dept } });
    setItems(data);
  }, []);

  const loadEntries = useCallback(async () => {
    const params = { department, search, from_date: from || undefined, to_date: to || undefined };
    if (progFilter && progFilter !== "all") params.program = progFilter;
    const { data } = await api.get("/stock", { params });
    setEntries(data);
  }, [department, search, from, to, progFilter]);

  const loadMeta = useCallback(async () => {
    const [m, s, p] = await Promise.all([
      api.get("/meta/manufacturers"),
      api.get("/meta/suppliers"),
      api.get("/meta/programs"),
    ]);
    setMeta({ manufacturers: m.data, suppliers: s.data, programs: p.data });
  }, []);

  useEffect(() => {
    loadItems(department);
    setSelectedItemId("");
    setPackSize("");
  }, [department, loadItems]);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const opts = useMemo(
    () => items.map((i) => ({ value: i.id, label: i.name, meta: `Pack: ${i.pack_size}`, pack: i.pack_size, name: i.name })),
    [items]
  );

  const onItemPick = (val, opt) => { setSelectedItemId(val); setPackSize(opt?.pack || ""); };

  const submit = async (e) => {
    e.preventDefault();
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return toast.error("Select an item");
    if (!qty || Number(qty) <= 0) return toast.error("Enter quantity");
    if (!expiry) return toast.error("Enter expiry date");
    try {
      await api.post("/stock", {
        item_id: item.id, department, item_name: item.name, pack_size: packSize || item.pack_size,
        quantity: Number(qty), receipt_date: receiptDate, lot_number: lotNumber,
        expiry_date: expiry, manufacturer, supplier, program,
      });
      toast.success("Stock entry recorded");
      setQty(""); setLotNumber(""); setExpiry("");
      loadEntries(); loadMeta();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const del = async (id) => {
    try { await api.delete(`/stock/${id}`); loadEntries(); toast.success("Deleted"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  return (
    <>
      <PageHeader title="Stock Entry" subtitle="Record received stock across departments" />
      <PageBody>
        <Card className="p-5">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger data-testid="se-department"><SelectValue /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Item name</Label>
              <Combobox value={selectedItemId} onChange={onItemPick} options={opts}
                placeholder={items.length ? "Search item…" : `No items in ${department}. Add via Items page.`}
                testid="se-item" />
            </div>
            <div>
              <Label>Pack size</Label>
              <Input data-testid="se-pack" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
            </div>
            <div>
              <Label>Quantity received</Label>
              <Input data-testid="se-qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <Label>Date of receipt</Label>
              <Input data-testid="se-receipt" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div>
              <Label>Lot number</Label>
              <Input data-testid="se-lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div>
              <Label>Date of expiry</Label>
              <Input data-testid="se-expiry" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div>
              <Label>Manufacturer</Label>
              <AutoInput id="mfr" testid="se-mfr" value={manufacturer} onChange={setManufacturer} options={meta.manufacturers} />
            </div>
            <div>
              <Label>Supplier</Label>
              <AutoInput id="sup" testid="se-sup" value={supplier} onChange={setSupplier} options={meta.suppliers} />
            </div>
            <div>
              <Label>Program</Label>
              <AutoInput id="prg" testid="se-prog" value={program} onChange={setProgram} options={meta.programs} />
            </div>
            <div className="flex items-end">
              <Button type="submit" data-testid="se-submit" className="w-full bg-indigo-950 hover:bg-indigo-900">
                Record Entry
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <Input placeholder="Search item…" className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="se-list-search" />
            <Select value={progFilter} onValueChange={setProgFilter}>
              <SelectTrigger className="w-44" data-testid="se-prog-filter"><SelectValue placeholder="All programs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                {meta.programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              From <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" data-testid="se-from" />
              To <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" data-testid="se-to" />
            </div>
            <div className="ml-auto text-xs text-slate-500">{entries.length} entries</div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Date</th><th>Dept</th><th>Item</th><th>Pack</th><th>Qty</th>
                  <th>Lot #</th><th>Expiry</th><th>Manufacturer</th><th>Supplier</th><th>Program</th><th></th>
                </tr>
              </thead>
              <tbody data-testid="se-list-body">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.receipt_date)}</td>
                    <td>{e.department}</td>
                    <td className="font-medium text-slate-900">{e.item_name}</td>
                    <td>{e.pack_size}</td>
                    <td className="tabular-nums">{e.quantity}</td>
                    <td>{e.lot_number}</td>
                    <td>{fmtDate(e.expiry_date)}</td>
                    <td>{e.manufacturer}</td>
                    <td>{e.supplier}</td>
                    <td>{e.program}</td>
                    <td>{user?.role === "admin" && (
                      <ConfirmDelete
                        testid={`se-del-${e.id}`}
                        title="Delete stock entry?"
                        description={`${e.item_name} · Lot ${e.lot_number} · Qty ${e.quantity}`}
                        onConfirm={() => del(e.id)}
                      />
                    )}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-slate-400">No entries recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
