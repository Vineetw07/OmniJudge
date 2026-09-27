import React from 'react';
import { renderToString } from 'react-dom/server';
(global as any).React = React;

async function testRender() {
  const results: { component: string; status: string; error?: string }[] = [];

  // 1. Avatar
  try {
    const { Avatar, AvatarFallback } = await import('@/components/ui/avatar');
    const html = renderToString(<Avatar><AvatarFallback>AB</AvatarFallback></Avatar>);
    results.push({ component: 'avatar', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'avatar', status: 'FAIL', error: e.message });
  }

  // 2. Badge
  try {
    const { Badge } = await import('@/components/ui/badge');
    const html = renderToString(<Badge>Test Badge</Badge>);
    results.push({ component: 'badge', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'badge', status: 'FAIL', error: e.message });
  }

  // 3. Button
  try {
    const { Button } = await import('@/components/ui/button');
    const html = renderToString(<Button variant="outline">Test Button</Button>);
    results.push({ component: 'button', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'button', status: 'FAIL', error: e.message });
  }

  // 4. Card
  try {
    const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } = await import('@/components/ui/card');
    const html = renderToString(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    results.push({ component: 'card', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'card', status: 'FAIL', error: e.message });
  }

  // 5. Dialog
  try {
    const { Dialog, DialogTrigger } = await import('@/components/ui/dialog');
    const html = renderToString(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
      </Dialog>
    );
    results.push({ component: 'dialog', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'dialog', status: 'FAIL', error: e.message });
  }

  // 6. DropdownMenu
  try {
    const { DropdownMenu, DropdownMenuTrigger } = await import('@/components/ui/dropdown-menu');
    const html = renderToString(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
      </DropdownMenu>
    );
    results.push({ component: 'dropdown-menu', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'dropdown-menu', status: 'FAIL', error: e.message });
  }

  // 7. Input
  try {
    const { Input } = await import('@/components/ui/input');
    const html = renderToString(<Input placeholder="Search..." />);
    results.push({ component: 'input', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'input', status: 'FAIL', error: e.message });
  }

  // 8. Label
  try {
    const { Label } = await import('@/components/ui/label');
    const html = renderToString(<Label htmlFor="test">Field Label</Label>);
    results.push({ component: 'label', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'label', status: 'FAIL', error: e.message });
  }

  // 9. Progress
  try {
    const { Progress } = await import('@/components/ui/progress');
    const html = renderToString(<Progress value={45} />);
    results.push({ component: 'progress', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'progress', status: 'FAIL', error: e.message });
  }

  // 10. Select
  try {
    const { Select, SelectTrigger, SelectValue } = await import('@/components/ui/select');
    const html = renderToString(
      <Select defaultValue="option1">
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
      </Select>
    );
    results.push({ component: 'select', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'select', status: 'FAIL', error: e.message });
  }

  // 11. Separator
  try {
    const { Separator } = await import('@/components/ui/separator');
    const html = renderToString(<Separator />);
    results.push({ component: 'separator', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'separator', status: 'FAIL', error: e.message });
  }

  // 12. Sheet
  try {
    const { Sheet, SheetTrigger } = await import('@/components/ui/sheet');
    const html = renderToString(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
      </Sheet>
    );
    results.push({ component: 'sheet', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'sheet', status: 'FAIL', error: e.message });
  }

  // 13. Table
  try {
    const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = await import('@/components/ui/table');
    const html = renderToString(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Col 1</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Val 1</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    results.push({ component: 'table', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'table', status: 'FAIL', error: e.message });
  }

  // 14. Tabs
  try {
    const { Tabs, TabsList, TabsTrigger, TabsContent } = await import('@/components/ui/tabs');
    const html = renderToString(
      <Tabs defaultValue="t1">
        <TabsList>
          <TabsTrigger value="t1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="t1">Tab 1 Content</TabsContent>
      </Tabs>
    );
    results.push({ component: 'tabs', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'tabs', status: 'FAIL', error: e.message });
  }

  // 15. Textarea
  try {
    const { Textarea } = await import('@/components/ui/textarea');
    const html = renderToString(<Textarea placeholder="Enter text" />);
    results.push({ component: 'textarea', status: 'PASS' });
  } catch (e: any) {
    results.push({ component: 'textarea', status: 'FAIL', error: e.message });
  }

  console.table(results);
  const allPass = results.every(r => r.status === 'PASS');
  console.log(`Render result: ${allPass ? 'ALL 15 COMPONENTS RENDERED SUCCESSFULLY' : 'SOME COMPONENTS FAILED'}`);
  process.exit(allPass ? 0 : 1);
}

testRender();
