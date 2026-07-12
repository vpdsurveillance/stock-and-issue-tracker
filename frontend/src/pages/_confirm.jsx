import React, { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

/**
 * <ConfirmDelete onConfirm={fn} title="..." description="..." testid="..." />
 * Renders a red trash icon button that opens an AlertDialog.
 */
export function ConfirmDelete({ onConfirm, title = "Delete?", description = "This cannot be undone.", testid, disabled }) {
  const [open, setOpen] = useState(false);
  const handle = async () => {
    setOpen(false);
    await onConfirm();
  };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete"
        data-testid={testid}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} className="text-red-600" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${testid}-cancel`}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid={`${testid}-confirm`}
            onClick={handle}
            className="bg-red-600 hover:bg-red-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
