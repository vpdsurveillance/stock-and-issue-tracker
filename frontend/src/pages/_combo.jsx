import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Typeahead combobox. options: [{value, label, meta?}] */
export function Combobox({ value, onChange, options, placeholder = "Select…", testid, disabled }) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testid}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm",
            "hover:border-slate-300 disabled:opacity-50"
          )}
        >
          <span className={sel ? "text-slate-900" : "text-slate-400"}>
            {sel ? sel.label : placeholder}
          </span>
          <ChevronsUpDown size={14} className="text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                  }}
                  data-testid={`${testid}-opt-${o.value}`}
                >
                  <Check
                    size={14}
                    className={cn("mr-2", value === o.value ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex-1">
                    <div>{o.label}</div>
                    {o.meta && <div className="text-xs text-slate-500">{o.meta}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Simple autocomplete input using datalist */
export function AutoInput({ value, onChange, options = [], placeholder, testid, id }) {
  const listId = id + "-list";
  return (
    <>
      <Input
        id={id}
        data-testid={testid}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}
