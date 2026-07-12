import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader, PageBody, ExportButton } from "./_shared";
import { Card } from "@/components/ui/card";
import { FilterBar, toParams } from "./_filterbar";
import { fmtDate, downloadExcel } from "@/lib/utils-app";

export default function CurrentStock() {
  const [rows, setRows] = useState([]);
  const [flt, setFlt] = useState({ department: "all", program: "all", search: "" });

  useEffect(() => {
    api.get("/reports/current-stock", { params: toParams(flt) }).then((r) => setRows(r.data));
  }, [flt]);

  return (
    <>
      <PageHeader
        title="Current Stock"
        subtitle="Live balance (Receipts − Issues) by lot and expiry"
        actions={<ExportButton onClick={() => downloadExcel(api, "current-stock", flt.department === "all" ? "" : flt.department)} />}
      />
      <PageBody>
        <Card>
          <FilterBar value={flt} onChange={setFlt} extras={<div className="ml-auto text-xs text-slate-500">{rows.length} lots</div>} />
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Dept</th><th>Item</th><th>Pack</th><th>Lot #</th><th>Expiry</th>
                  <th>Manufacturer</th><th>Supplier</th><th>Program</th>
                  <th className="text-right">Received</th><th className="text-right">Issued</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody data-testid="cs-body">
                {rows.map((r, i) => (
                  <tr key={i} className={r.balance <= 0 ? "opacity-60" : ""}>
                    <td>{r.department}</td>
                    <td className="font-medium text-slate-900">{r.item_name}</td>
                    <td>{r.pack_size}</td>
                    <td>{r.lot_number}</td>
                    <td>{fmtDate(r.expiry_date)}</td>
                    <td>{r.manufacturer}</td>
                    <td>{r.supplier}</td>
                    <td>{r.program}</td>
                    <td className="text-right tabular-nums">{r.received}</td>
                    <td className="text-right tabular-nums">{r.issued}</td>
                    <td className={`text-right tabular-nums font-bold ${r.balance <= 0 ? "text-red-600" : "text-slate-900"}`}>
                      {r.balance}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-slate-400">No stock yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
