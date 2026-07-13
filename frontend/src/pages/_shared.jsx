import React from "react";
import { Button } from "@/components/ui/button";
import { Download, ChevronRight } from "lucide-react";

export function PageHeader({ title, subtitle, breadcrumb, actions }) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="max-w-[1600px] mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          {breadcrumb && (
            <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
              {breadcrumb.map((b) => (
                <React.Fragment key={b}>
                  <span>{b}</span>
                  {b !== breadcrumb[breadcrumb.length - 1] && <ChevronRight size={12} />}
                </React.Fragment>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-heading font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function ExportButton({ onClick, testid }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      data-testid={testid || "export-btn"}
      className="gap-2"
    >
      <Download size={15} /> Export Excel
    </Button>
  );
}

export function PageBody({ children }) {
  return <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">{children}</div>;
}
