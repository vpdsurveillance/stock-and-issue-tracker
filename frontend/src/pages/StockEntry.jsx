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
  const [neverEnteredItems, setNeverEnteredItems] = useState([]);

  const [activeTab, setActiveTab] = useState("entry");

  const [meta, setMeta] = useState({
    manufacturers: [],
    suppliers: [],
    programs: [],
  });

  const [search, setSearch] = useState("");
  const [progFilter, setProgFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingNeverEntered, setLoadingNeverEntered] = useState(false);

  /* -----------------------------------------------------------
     EXPORT STOCK ENTRIES
  ----------------------------------------------------------- */

  const exportToExcel = async () => {
    try {
      const response = await api.get("/export/stock", {
        params: { department },
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

  /* -----------------------------------------------------------
     EXPORT NEVER STOCKED ITEMS
  ----------------------------------------------------------- */

  const exportNeverStocked = async () => {
    try {
      const response = await api.get("/export/never-stocked", {
        params: { department },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `Never_Stocked_${department}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      toast.success("Never stocked items exported successfully");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to export never stocked items"
      );
    }
  };

  /* -----------------------------------------------------------
     LOAD MASTER ITEMS
  ----------------------------------------------------------- */

  const loadItems = useCallback(async (dept) => {
    try {
      const { data } = await api.get("/items", {
        params: { department: dept },
      });

      setItems(data || []);
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load items"
      );
    }
  }, []);

  /* -----------------------------------------------------------
     LOAD STOCK ENTRIES
  ----------------------------------------------------------- */

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

      const { data } = await api.get("/stock", { params });

      setEntries(data || []);
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load stock entries"
      );
    }
  }, [department, search, from, to, progFilter]);

  /* -----------------------------------------------------------
     LOAD ITEMS THAT NEVER HAD STOCK ENTRY
  ----------------------------------------------------------- */

  const loadNeverEnteredItems = useCallback(async () => {
    setLoadingNeverEntered(true);

    try {
      const { data } = await api.get("/stock/never-entered", {
        params: {
          department,
        },
      });

      setNeverEnteredItems(data || []);
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          "Failed to load items without stock entry"
      );

      setNeverEnteredItems([]);
    } finally {
      setLoadingNeverEntered(false);
    }
  }, [department]);

  /* -----------------------------------------------------------
     LOAD METADATA
  ----------------------------------------------------------- */

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

  /* -----------------------------------------------------------
     DEPARTMENT CHANGE
  ----------------------------------------------------------- */

  useEffect(() => {
    loadItems(department);

    setSelectedItemId("");
    setPackSize("");
  }, [department, loadItems]);

  /* -----------------------------------------------------------
     LOAD STOCK ENTRIES
  ----------------------------------------------------------- */

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  /* -----------------------------------------------------------
     LOAD NEVER ENTERED ITEMS
  ----------------------------------------------------------- */

  useEffect(() => {
    loadNeverEnteredItems();
  }, [loadNeverEnteredItems]);

  /* -----------------------------------------------------------
     LOAD METADATA
  ----------------------------------------------------------- */

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  /* -----------------------------------------------------------
     ITEM OPTIONS
  ----------------------------------------------------------- */

  const opts = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: i.name,
        meta: `Pack: ${i.pack_size || ""}`,
        pack: i.pack_size || "",
        name: i.name,
      })),
    [items]
  );

  /* -----------------------------------------------------------
     ITEM SELECTION
  ----------------------------------------------------------- */

  const onItemPick = (val, opt) => {
    setSelectedItemId(val);
    setPackSize(opt?.pack || "");
  };

  /* -----------------------------------------------------------
     RECORD STOCK ENTRY
     IMPORTANT:
     Backend route is POST /stock/batch
  ----------------------------------------------------------- */

  const submit = async (e) => {
    e.preventDefault();

    const item = items.find((i) => i.id === selectedItemId);

    if (!item) {
      toast.error("Select an item");
      return;
    }

    if (!qty || Number(qty) <= 0) {
      toast.error("Enter quantity");
      return;
    }

    if (!receiptDate) {
      toast.error("Enter receipt date");
      return;
    }

    if (!expiry) {
      toast.error("Enter expiry date");
      return;
    }

    setLoading(true);

    try {
      /*
       * IMPORTANT FIX:
       *
       * Backend expects:
       * POST /api/stock/batch
       *
       * Body:
       * {
       *   items: [
       *     {
       *       ...
       *     }
       *   ]
       * }
       */

      await api.post("/stock/batch", {
        items: [
          {
            item_id: item.id,
            department,
            item_name: item.name,
            pack_size: packSize || item.pack_size || "",
            quantity: Number(qty),
            receipt_date: receiptDate,
            lot_number: lotNumber,
            expiry_date: expiry,
            manufacturer,
            supplier,
            program,
          },
        ],
      });

      toast.success("Stock entry recorded successfully");

      /* Clear entry fields */

      setSelectedItemId("");
      setPackSize("");
      setQty("");
      setLotNumber("");
      setExpiry("");
      setManufacturer("");
      setSupplier("");
      setProgram("");
      setReceiptDate(todayISO());

      /* Refresh stock table */

      await loadEntries();

      /* Refresh never-entered list */

      await loadNeverEnteredItems();

      /* Refresh metadata */

      await loadMeta();
    } catch (err) {
      console.error("Stock entry error:", err);

      toast.error(
        formatApiError(err.response?.data?.detail) ||
          err.response?.data?.message ||
          err.message ||
          "Failed to record stock entry"
      );
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------------------------------------
     DELETE STOCK ENTRY
  ----------------------------------------------------------- */

  const del = async (id) => {
    try {
      await api.delete(`/stock/${id}`);

      await loadEntries();
      await loadNeverEnteredItems();

      toast.success("Stock entry deleted");
    } catch (err) {
      toast.error(
        formatApiError(err.response?.data?.detail) ||
          err.message ||
          "Failed to delete stock entry"
      );
    }
  };

  /* -----------------------------------------------------------
     RENDER
  ----------------------------------------------------------- */

  return (
    <>
      <PageHeader
        title="Stock Entry"
        description="Record laboratory stock receipts and view stock history."
      />

      <PageBody>
        {/* =====================================================
            DEPARTMENT
        ===================================================== */}

        <div className="mb-6">
          <Label className="mb-2 block">Department</Label>

          <Select
            value={department}
            onValueChange={(value) => setDepartment(value)}
          >
            <SelectTrigger className="w-full md:w-[250px]">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>

            <SelectContent>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* =====================================================
            TABS
        ===================================================== */}

        <div className="flex flex-wrap gap-2 mb-6 border-b pb-3">
          <Button
            type="button"
            variant={activeTab === "entry" ? "default" : "outline"}
            onClick={() => setActiveTab("entry")}
          >
            Stock Entry
          </Button>

          <Button
            type="button"
            variant={activeTab === "entries" ? "default" : "outline"}
            onClick={() => setActiveTab("entries")}
          >
            Stock Entries
          </Button>

          <Button
            type="button"
            variant={
              activeTab === "never-entered" ? "default" : "outline"
            }
            onClick={() => {
              setActiveTab("never-entered");
              loadNeverEnteredItems();
            }}
          >
            Never Stock Entered
          </Button>
        </div>

        {/* =====================================================
            STOCK ENTRY FORM
        ===================================================== */}

        {activeTab === "entry" && (
          <Card className="p-6 mb-6">
            <form onSubmit={submit}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* ITEM */}

                <div>
                  <Label className="mb-2 block">Item</Label>

                  <Combobox
                    options={opts}
                    value={selectedItemId}
                    onValueChange={onItemPick}
                    placeholder="Select item"
                    searchPlaceholder="Search item..."
                  />
                </div>

                {/* PACK SIZE */}

                <div>
                  <Label className="mb-2 block">Pack Size</Label>

                  <Input
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    placeholder="Pack size"
                  />
                </div>

                {/* QUANTITY */}

                <div>
                  <Label className="mb-2 block">Quantity</Label>

                  <Input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>

                {/* RECEIPT DATE */}

                <div>
                  <Label className="mb-2 block">Receipt Date</Label>

                  <Input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                  />
                </div>

                {/* LOT NUMBER */}

                <div>
                  <Label className="mb-2 block">Lot Number</Label>

                  <Input
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Lot number"
                  />
                </div>

                {/* EXPIRY */}

                <div>
                  <Label className="mb-2 block">Expiry Date</Label>

                  <Input
                    type="date"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </div>

                {/* MANUFACTURER */}

                <div>
                  <Label className="mb-2 block">Manufacturer</Label>

                  <AutoInput
                    value={manufacturer}
                    onChange={setManufacturer}
                    options={meta.manufacturers}
                    placeholder="Manufacturer"
                  />
                </div>

                {/* SUPPLIER */}

                <div>
                  <Label className="mb-2 block">Supplier</Label>

                  <AutoInput
                    value={supplier}
                    onChange={setSupplier}
                    options={meta.suppliers}
                    placeholder="Supplier"
                  />
                </div>

                {/* PROGRAM */}

                <div>
                  <Label className="mb-2 block">Program</Label>

                  <AutoInput
                    value={program}
                    onChange={setProgram}
                    options={meta.programs}
                    placeholder="Program"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Recording..." : "Record Stock Entry"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* =====================================================
            STOCK ENTRIES TAB
        ===================================================== */}

        {activeTab === "entries" && (
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
              {/* SEARCH */}

              <div className="flex-1">
                <Label className="mb-2 block">Search</Label>

                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item, lot, manufacturer, supplier..."
                />
              </div>

              {/* PROGRAM FILTER */}

              <div className="w-full lg:w-[220px]">
                <Label className="mb-2 block">Program</Label>

                <Select
                  value={progFilter}
                  onValueChange={setProgFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All programs" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      All programs
                    </SelectItem>

                    {meta.programs.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* FROM */}

              <div>
                <Label className="mb-2 block">From</Label>

                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              {/* TO */}

              <div>
                <Label className="mb-2 block">To</Label>

                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {/* EXPORT */}

              <Button
                type="button"
                variant="outline"
                onClick={exportToExcel}
              >
                Export Excel
              </Button>
            </div>

            {/* TABLE */}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Item</th>
                    <th className="text-left p-3">Pack Size</th>
                    <th className="text-left p-3">Quantity</th>
                    <th className="text-left p-3">Lot No.</th>
                    <th className="text-left p-3">Expiry</th>
                    <th className="text-left p-3">Manufacturer</th>
                    <th className="text-left p-3">Supplier</th>
                    <th className="text-left p-3">Program</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="p-6 text-center text-muted-foreground"
                      >
                        No stock entries found.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="p-3">
                          {fmtDate(entry.receipt_date)}
                        </td>

                        <td className="p-3">
                          {entry.item_name}
                        </td>

                        <td className="p-3">
                          {entry.pack_size}
                        </td>

                        <td className="p-3">
                          {entry.quantity}
                        </td>

                        <td className="p-3">
                          {entry.lot_number}
                        </td>

                        <td className="p-3">
                          {fmtDate(entry.expiry_date)}
                        </td>

                        <td className="p-3">
                          {entry.manufacturer}
                        </td>

                        <td className="p-3">
                          {entry.supplier}
                        </td>

                        <td className="p-3">
                          {entry.program}
                        </td>

                        <td className="p-3">
                          <ConfirmDelete
                            title="Delete stock entry?"
                            description="This stock entry will be permanently deleted."
                            onConfirm={() => del(entry.id)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* =====================================================
            NEVER STOCK ENTERED TAB
        ===================================================== */}

        {activeTab === "never-entered" && (
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Items Never Stock Entered
                </h2>

                <p className="text-sm text-muted-foreground mt-1">
                  Master-list items in {department} that have never had
                  any stock entry recorded.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadNeverEnteredItems}
                  disabled={loadingNeverEntered}
                >
                  {loadingNeverEntered ? "Refreshing..." : "Refresh"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={exportNeverStocked}
                >
                  Export Excel
                </Button>
              </div>
            </div>

            {/* SUMMARY */}

            <div className="mb-5 rounded-lg border p-4 bg-muted/20">
              <div className="text-sm text-muted-foreground">
                Department
              </div>

              <div className="text-xl font-semibold">
                {department}
              </div>

              <div className="mt-2 text-sm">
                Never stock entered:{" "}
                <span className="font-semibold">
                  {neverEnteredItems.length}
                </span>
              </div>
            </div>

            {/* NEVER ENTERED TABLE */}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3">
                      Sl. No.
                    </th>

                    <th className="text-left p-3">
                      Item Name
                    </th>

                    <th className="text-left p-3">
                      Pack Size
                    </th>

                    <th className="text-left p-3">
                      Department
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loadingNeverEntered ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-6 text-center text-muted-foreground"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : neverEnteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="p-6 text-center text-muted-foreground"
                      >
                        No items without stock entry found.
                      </td>
                    </tr>
                  ) : (
                    neverEnteredItems.map((item, index) => (
                      <tr
                        key={item.id}
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="p-3">
                          {index + 1}
                        </td>

                        <td className="p-3 font-medium">
                          {item.item_name}
                        </td>

                        <td className="p-3">
                          {item.pack_size || "-"}
                        </td>

                        <td className="p-3">
                          {item.department}
                        </td>
                      </tr>
                    ))
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
