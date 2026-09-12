import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader, PageBody } from "./_shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Combobox, AutoInput } from "./_combo";
import { DEPARTMENTS, fmtDate } from "@/lib/utils-app";
import { ConfirmDelete } from "./_confirm";
import { useAuth } from "@/lib/auth";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StockEntry() {
  const { user } = useAuth();

  // ============================================================
  // MAIN STATE
  // ============================================================

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

  // ============================================================
  // NEVER STOCK ENTERED
  // ============================================================

  const [neverEnteredItems, setNeverEnteredItems] = useState([]);
  const [neverEnteredSearch, setNeverEnteredSearch] = useState("");

  const [activeTab, setActiveTab] = useState("entries");

  // ============================================================
  // METADATA
  // ============================================================

  const [meta, setMeta] = useState({
    manufacturers: [],
    suppliers: [],
    programs: [],
  });

  // ============================================================
  // STOCK ENTRY FILTERS
  // ============================================================

  const [search, setSearch] = useState("");
  const [progFilter, setProgFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // ============================================================
  // EXPORT STOCK ENTRIES
  // ============================================================

  const exportToExcel = async () => {
    try {
      const response = await api.get("/export/stock", {
        params: {
          department,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `Stock_Entries_${department}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Stock entries exported successfully");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to export stock entries"
      );
    }
  };

  // ============================================================
  // EXPORT NEVER STOCKED ITEMS
  // ============================================================

  const exportNeverEnteredToExcel = async () => {
    try {
      const response = await api.get("/export/never-stocked", {
        params: {
          department,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `Items_Never_Stocked_${department}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Never-stocked items exported successfully");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to export never-stocked items"
      );
    }
  };

  // ============================================================
  // LOAD MASTER ITEMS
  // ============================================================

  const loadItems = useCallback(async (dept) => {
    try {
      const { data } = await api.get("/items", {
        params: {
          department: dept,
        },
      });

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load items"
      );

      setItems([]);
    }
  }, []);

  // ============================================================
  // LOAD STOCK ENTRIES
  // ============================================================

  const loadEntries = useCallback(async () => {
    try {
      const params = {
        department,
        search,
        from_date: from || undefined,
        to_date: to || undefined,
      };

      if (progFilter && progFilter !== "all") {
        params.program = progFilter;
      }

      const { data } = await api.get("/stock", {
        params,
      });

      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load stock entries"
      );

      setEntries([]);
    }
  }, [
    department,
    search,
    from,
    to,
    progFilter,
  ]);

  // ============================================================
  // LOAD MASTER ITEMS THAT NEVER HAD STOCK ENTRY
  //
  // IMPORTANT:
  // Backend endpoint:
  //
  // GET /api/stock/never-entered?department=MDS
  //
  // It compares:
  //
  //     db.items
  //
  // against:
  //
  //     db.stock_entries.item_id
  //
  // Therefore an item is displayed here ONLY when:
  //
  // 1. It exists in Master Data
  // 2. It belongs to the selected department
  // 3. Its item_id has NEVER been used in Stock Entry
  // ============================================================

  const loadNeverEnteredItems = useCallback(async () => {
    try {
      const { data } = await api.get(
        "/stock/never-entered",
        {
          params: {
            department,
          },
        }
      );

      setNeverEnteredItems(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error(
        "Never-entered items error:",
        err
      );

      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load items without stock entry"
      );

      setNeverEnteredItems([]);
    }
  }, [department]);

  // ============================================================
  // LOAD METADATA
  // ============================================================

  const loadMeta = useCallback(async () => {
    try {
      const [m, s, p] = await Promise.all([
        api.get("/meta/manufacturers"),
        api.get("/meta/suppliers"),
        api.get("/meta/programs"),
      ]);

      setMeta({
        manufacturers: m.data || [],
        suppliers: s.data || [],
        programs: p.data || [],
      });
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load metadata"
      );
    }
  }, []);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    loadItems(department);

    setSelectedItemId("");
    setPackSize("");
  }, [
    department,
    loadItems,
  ]);

  // Load stock entries whenever filters/department change
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load never-stock-entered items whenever department changes
  useEffect(() => {
    loadNeverEnteredItems();
  }, [loadNeverEnteredItems]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // ============================================================
  // ITEM OPTIONS
  // ============================================================

  const opts = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: i.name,
        meta: `Pack: ${i.pack_size}`,
        pack: i.pack_size,
        name: i.name,
      })),
    [items]
  );

  // ============================================================
  // NEVER STOCKED SEARCH
  // ============================================================

  const filteredNeverEnteredItems = useMemo(() => {
    const q = neverEnteredSearch
      .trim()
      .toLowerCase();

    if (!q) {
      return neverEnteredItems;
    }

    return neverEnteredItems.filter((item) => {
      return (
        String(item.item_name || "")
          .toLowerCase()
          .includes(q) ||
        String(item.pack_size || "")
          .toLowerCase()
          .includes(q) ||
        String(item.department || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [
    neverEnteredItems,
    neverEnteredSearch,
  ]);

  // ============================================================
  // ITEM SELECTION
  // ============================================================

  const onItemPick = (val, opt) => {
    setSelectedItemId(val);

    setPackSize(
      opt?.pack || ""
    );
  };

  // ============================================================
  // SUBMIT STOCK ENTRY
  // ============================================================

  const submit = async (e) => {
    e.preventDefault();

    const item = items.find(
      (i) => i.id === selectedItemId
    );

    if (!item) {
      return toast.error(
        "Select an item"
      );
    }

    if (
      !qty ||
      Number(qty) <= 0
    ) {
      return toast.error(
        "Enter quantity"
      );
    }

    if (!expiry) {
      return toast.error(
        "Enter expiry date"
      );
    }

    try {
      // ========================================================
      // KEEPING THE ORIGINAL STOCK ENTRY ROUTE
      // ========================================================

      await api.post("/stock", {
        item_id: item.id,
        department,
        item_name: item.name,
        pack_size:
          packSize ||
          item.pack_size,
        quantity: Number(qty),
        receipt_date: receiptDate,
        lot_number: lotNumber,
        expiry_date: expiry,
        manufacturer,
        supplier,
        program,
      });

      toast.success(
        "Stock entry recorded"
      );

      setQty("");
      setLotNumber("");
      setExpiry("");

      // Refresh stock entries
      await loadEntries();

      // IMPORTANT:
      // If this item was previously in
      // "Never Stock Entered", it will now
      // disappear from that list.
      await loadNeverEnteredItems();

      await loadMeta();
    } catch (err) {
      toast.error(
        formatApiError(
          err.response?.data?.detail
        ) ||
          err.message ||
          "Failed to record stock entry"
      );
    }
  };

  // ============================================================
  // DELETE STOCK ENTRY
  // ============================================================

  const del = async (id) => {
    try {
      await api.delete(
        `/stock/${id}`
      );

      await loadEntries();

      // IMPORTANT:
      // If the deleted entry was the ONLY
      // stock entry for that item, the item
      // will appear again in
      // "Never Stock Entered".
      await loadNeverEnteredItems();

      toast.success(
        "Deleted"
      );
    } catch (err) {
      toast.error(
        formatApiError(
          err.response?.data?.detail
        ) ||
          err.message ||
          "Failed to delete stock entry"
      );
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <PageHeader
        title="Stock Entry"
        subtitle="Record received stock across departments"
      />

      <PageBody>

        {/* ======================================================
            STOCK ENTRY FORM
        ====================================================== */}

        <Card className="p-5">
          <form
            onSubmit={submit}
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >

            {/* Department */}

            <div>
              <Label>
                Department
              </Label>

              <Select
                value={department}
                onValueChange={
                  setDepartment
                }
              >
                <SelectTrigger
                  data-testid="se-department"
                >
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {DEPARTMENTS.map(
                    (d) => (
                      <SelectItem
                        key={d}
                        value={d}
                      >
                        {d}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Item */}

            <div className="md:col-span-2">
              <Label>
                Item name
              </Label>

              <Combobox
                value={
                  selectedItemId
                }
                onChange={
                  onItemPick
                }
                options={opts}
                placeholder={
                  items.length
                    ? "Search item…"
                    : `No items in ${department}. Add via Items page.`
                }
                testid="se-item"
              />
            </div>

            {/* Pack size */}

            <div>
              <Label>
                Pack size
              </Label>

              <Input
                data-testid="se-pack"
                value={packSize}
                onChange={(e) =>
                  setPackSize(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Quantity */}

            <div>
              <Label>
                Quantity received
              </Label>

              <Input
                data-testid="se-qty"
                type="number"
                min="1"
                value={qty}
                onChange={(e) =>
                  setQty(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Receipt date */}

            <div>
              <Label>
                Date of receipt
              </Label>

              <Input
                data-testid="se-receipt"
                type="date"
                value={
                  receiptDate
                }
                onChange={(e) =>
                  setReceiptDate(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Lot */}

            <div>
              <Label>
                Lot number
              </Label>

              <Input
                data-testid="se-lot"
                value={lotNumber}
                onChange={(e) =>
                  setLotNumber(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Expiry */}

            <div>
              <Label>
                Date of expiry
              </Label>

              <Input
                data-testid="se-expiry"
                type="date"
                value={expiry}
                onChange={(e) =>
                  setExpiry(
                    e.target.value
                  )
                }
              />
            </div>

            {/* Manufacturer */}

            <div>
              <Label>
                Manufacturer
              </Label>

              <AutoInput
                id="mfr"
                testid="se-mfr"
                value={
                  manufacturer
                }
                onChange={
                  setManufacturer
                }
                options={
                  meta.manufacturers
                }
              />
            </div>

            {/* Supplier */}

            <div>
              <Label>
                Supplier
              </Label>

              <AutoInput
                id="sup"
                testid="se-sup"
                value={supplier}
                onChange={
                  setSupplier
                }
                options={
                  meta.suppliers
                }
              />
            </div>

            {/* Program */}

            <div>
              <Label>
                Program
              </Label>

              <AutoInput
                id="prg"
                testid="se-prog"
                value={program}
                onChange={
                  setProgram
                }
                options={
                  meta.programs
                }
              />
            </div>

            {/* Submit */}

            <div className="flex items-end">
              <Button
                type="submit"
                data-testid="se-submit"
                className="w-full bg-indigo-950 hover:bg-indigo-900"
              >
                Record Entry
              </Button>
            </div>

          </form>
        </Card>

        {/* ======================================================
            TABS
        ====================================================== */}

        <div className="flex items-center gap-2 border-b border-slate-200 mt-6">

          <Button
            type="button"
            variant={
              activeTab === "entries"
                ? "default"
                : "outline"
            }
            onClick={() =>
              setActiveTab(
                "entries"
              )
            }
            className={
              activeTab === "entries"
                ? "bg-indigo-950 hover:bg-indigo-900"
                : ""
            }
          >
            Stock Entries
          </Button>

          <Button
            type="button"
            variant={
              activeTab ===
              "never-entered"
                ? "default"
                : "outline"
            }
            onClick={() =>
              setActiveTab(
                "never-entered"
              )
            }
            className={
              activeTab ===
              "never-entered"
                ? "bg-indigo-950 hover:bg-indigo-900"
                : ""
            }
          >
            Never Stock Entered
          </Button>

        </div>

        {/* ======================================================
            STOCK ENTRIES TAB
        ====================================================== */}

        {activeTab === "entries" && (
          <Card>

            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center gap-2">

              {/* Search */}

              <Input
                placeholder="Search item…"
                className="max-w-xs"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                data-testid="se-list-search"
              />

              {/* Program filter */}

              <Select
                value={
                  progFilter
                }
                onValueChange={
                  setProgFilter
                }
              >
                <SelectTrigger
                  className="w-44"
                  data-testid="se-prog-filter"
                >
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="all">
                    All programs
                  </SelectItem>

                  {meta.programs.map(
                    (p) => (
                      <SelectItem
                        key={p}
                        value={p}
                      >
                        {p}
                      </SelectItem>
                    )
                  )}

                </SelectContent>
              </Select>

              {/* Date filter */}

              <div className="flex items-center gap-1 text-xs text-slate-500">

                <span>
                  From
                </span>

                <Input
                  type="date"
                  value={from}
                  onChange={(e) =>
                    setFrom(
                      e.target.value
                    )
                  }
                  className="h-8"
                  data-testid="se-from"
                />

                <span>
                  To
                </span>

                <Input
                  type="date"
                  value={to}
                  onChange={(e) =>
                    setTo(
                      e.target.value
                    )
                  }
                  className="h-8"
                  data-testid="se-to"
                />

              </div>

              {/* Export */}

              <div className="ml-auto flex items-center gap-2">

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    exportToExcel
                  }
                >
                  Export Excel
                </Button>

                <div className="text-xs text-slate-500">
                  {entries.length}{" "}
                  entries
                </div>

              </div>

            </div>

            {/* Stock table */}

            <div className="overflow-x-auto">

              <table className="data-table w-full">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Dept</th>
                    <th>Item</th>
                    <th>Pack</th>
                    <th>Qty</th>
                    <th>Lot #</th>
                    <th>Expiry</th>
                    <th>Manufacturer</th>
                    <th>Supplier</th>
                    <th>Program</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody data-testid="se-list-body">

                  {entries.map(
                    (e) => (
                      <tr key={e.id}>

                        <td>
                          {fmtDate(
                            e.receipt_date
                          )}
                        </td>

                        <td>
                          {e.department}
                        </td>

                        <td className="font-medium text-slate-900">
                          {e.item_name}
                        </td>

                        <td>
                          {e.pack_size}
                        </td>

                        <td className="tabular-nums">
                          {e.quantity}
                        </td>

                        <td>
                          {e.lot_number}
                        </td>

                        <td>
                          {fmtDate(
                            e.expiry_date
                          )}
                        </td>

                        <td>
                          {e.manufacturer}
                        </td>

                        <td>
                          {e.supplier}
                        </td>

                        <td>
                          {e.program}
                        </td>

                        <td>
                          {user?.role ===
                            "admin" && (
                            <ConfirmDelete
                              testid={`se-del-${e.id}`}
                              title="Delete stock entry?"
                              description={`${e.item_name} · Lot ${e.lot_number} · Qty ${e.quantity}`}
                              onConfirm={() =>
                                del(
                                  e.id
                                )
                              }
                            />
                          )}
                        </td>

                      </tr>
                    )
                  )}

                  {entries.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="text-center py-8 text-slate-400"
                      >
                        No entries
                        recorded.
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>

          </Card>
        )}

        {/* ======================================================
            NEVER STOCK ENTERED TAB
        ====================================================== */}

        {activeTab ===
          "never-entered" && (
          <Card>

            {/* Header */}

            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">

              <div>
                <h3 className="font-semibold text-slate-900">
                  Items without stock entry
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Master Data items that have
                  never had a stock entry.
                </p>
              </div>

              <div className="ml-auto flex items-center gap-2">

                <Input
                  placeholder="Search item…"
                  className="w-56"
                  value={
                    neverEnteredSearch
                  }
                  onChange={(e) =>
                    setNeverEnteredSearch(
                      e.target.value
                    )
                  }
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    loadNeverEnteredItems
                  }
                >
                  Refresh
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    exportNeverEnteredToExcel
                  }
                >
                  Export Excel
                </Button>

              </div>

            </div>

            {/* Department information */}

            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">

              <div className="text-sm text-slate-600">

                Department:
                <span className="font-semibold text-slate-900 ml-1">
                  {department}
                </span>

              </div>

              <div className="text-sm text-slate-600">

                Master items:
                <span className="font-semibold text-slate-900 ml-1">
                  {items.length}
                </span>

                <span className="mx-2">
                  |
                </span>

                Never stock entered:
                <span className="font-semibold text-red-600 ml-1">
                  {
                    filteredNeverEnteredItems.length
                  }
                </span>

              </div>

            </div>

            {/* Never stocked table */}

            <div className="overflow-x-auto">

              <table className="data-table w-full">

                <thead>

                  <tr>
                    <th>Sl. No.</th>
                    <th>Department</th>
                    <th>Item Name</th>
                    <th>Pack Size</th>
                  </tr>

                </thead>

                <tbody>

                  {filteredNeverEnteredItems.map(
                    (item, index) => (
                      <tr
                        key={
                          item.id
                        }
                      >

                        <td>
                          {index + 1}
                        </td>

                        <td>
                          {item.department}
                        </td>

                        <td className="font-medium text-slate-900">
                          {
                            item.item_name
                          }
                        </td>

                        <td>
                          {
                            item.pack_size
                          }
                        </td>

                      </tr>
                    )
                  )}

                  {filteredNeverEnteredItems.length ===
                    0 && (
                    <tr>

                      <td
                        colSpan={4}
                        className="text-center py-10"
                      >

                        {neverEnteredItems.length ===
                        0 ? (
                          <div>
                            <div className="text-slate-500 font-medium">
                              No items found
                            </div>

                            <div className="text-xs text-slate-400 mt-1">
                              There are no Master
                              Data items in{" "}
                              {department}{" "}
                              that are currently
                              without a stock entry.
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            No items match
                            your search.
                          </div>
                        )}

                      </td>

                    </tr>
                  )}

                </tbody>

              </table>

            </div>

          </Card>
        )}

      </PageBody>
    </>
  );
}
