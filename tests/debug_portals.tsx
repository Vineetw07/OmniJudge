import React from 'react';
import { renderToString } from 'react-dom/server';

(globalThis as any).React = React;

async function debugPortals() {
  const { Dialog, DialogContent } = await import('@/components/ui/dialog');
  const dHtml = renderToString(
    <Dialog open={true}>
      <DialogContent>Hello Dialog</DialogContent>
    </Dialog>
  );
  console.log('Dialog open HTML:', JSON.stringify(dHtml));

  const { Sheet, SheetContent } = await import('@/components/ui/sheet');
  const sHtml = renderToString(
    <Sheet open={true}>
      <SheetContent>Hello Sheet</SheetContent>
    </Sheet>
  );
  console.log('Sheet open HTML:', JSON.stringify(sHtml));

  const { DropdownMenu, DropdownMenuContent, DropdownMenuItem } = await import('@/components/ui/dropdown-menu');
  const mHtml = renderToString(
    <DropdownMenu open={true}>
      <DropdownMenuContent>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  console.log('DropdownMenu open HTML:', JSON.stringify(mHtml));

  const { Select, SelectContent, SelectItem } = await import('@/components/ui/select');
  const selHtml = renderToString(
    <Select open={true}>
      <SelectContent>
        <SelectItem value="1">Item 1</SelectItem>
      </SelectContent>
    </Select>
  );
  console.log('Select open HTML:', JSON.stringify(selHtml));
}

debugPortals();
