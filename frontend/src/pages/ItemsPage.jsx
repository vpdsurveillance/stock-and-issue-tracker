import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { downloadExcel, fmtDate } from "@/lib/utils-app";
import { ConfirmDelete } from "./_confirm";

export default function ItemsPage() {
  const { department } = useParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [packSize, setPackSize] = useState("");
  const fileRef = useRef();

  const load = useCallback(async () => {
    const { data } = await api.get("/items", { params: { department, search } });
    setItems(data);
  }, [department, search]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim() || !packSize.trim()) return toast.error("Enter name and pack size");
    try {
      await api.post("/items", { name, pack_size: packSize, department });
      toast.success("Item added");
      setOpen(false); setName(""); setPackSize("");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const del = async (id) => {
    try {
      await api.delete(`/items/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/import/items?department=${department}`, fd);
      toast.success(`Imported ${data.inserted}, skipped ${data.skipped}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const isAdmin = user?.role === "admin";

  return (
    <>
      <PageHeader
        title={`Items — ${department}`}
        subtitle={`Master list of ${department} department items`}
        breadcrumb={["Inventory Master", department]}
        actions={
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onImport} data-testid="import-input" />
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                data-testid="import-btn"
                className="gap-2"
              >
                <Upload size={15} /> Import
              </Button>
            )}
            <ExportButton onClick={() => downloadExcel(api, "items", department)} testid="export-items" />
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-indigo-950 hover:bg-indigo-900" data-testid="add-item-btn">
                    <Plus size={15} /> Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add {department} item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Item name</Label>
                      <Input data-testid="add-item-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Pack size</Label>
                      <Input
                        data-testid="add-item-pack"
                        placeholder="e.g. 500 ml, 100 tabs"
                        value={packSize}
                        onChange={(e) => setPackSize(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={add} data-testid="add-item-save" className="bg-indigo-950 hover:bg-indigo-900">
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />
      <PageBody>
        <Card className="overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                data-testid="items-search"
                placeholder="Search items…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-xs text-slate-500 ml-auto">{items.length} item(s)</div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Pack Size</th>
                  <th>Added</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody data-testid="items-table-body">
                {items.map((it, i) => (
                  <tr key={it.id}>
                    <td className="text-slate-400">{i + 1}</td>
                    <td className="font-medium text-slate-900">{it.name}</td>
                    <td>{it.pack_size}</td>
                    <td className="text-slate-500">{fmtDate(it.created_at)}</td>
                    <td className="text-right">
                      {isAdmin && (
                        <ConfirmDelete
                          testid={`del-item-${it.id}`}
                          title={`Delete "${it.name}"?`}
                          description="The master item will be permanently removed."
                          onConfirm={() => del(it.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      No items yet. Click <span className="font-medium">Add Item</span> to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
