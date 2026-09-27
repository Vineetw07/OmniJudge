import React from 'react';
import { renderToString } from 'react-dom/server';

(global as any).React = React;

async function runSSRStressTests() {
  console.log('--- Adversarial Test: SSR Rendering of All 15 UI Components ---');
  let failures = 0;
  const testResults: { test: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

  function record(test: string, fn: () => void) {
    try {
      fn();
      testResults.push({ test, status: 'PASS' });
      console.log(`[PASS] ${test}`);
    } catch (e: any) {
      testResults.push({ test, status: 'FAIL', error: e?.message || String(e) });
      console.error(`[FAIL] ${test}:`, e);
      failures++;
    }
  }

  // 1. Avatar
  const { Avatar, AvatarImage, AvatarFallback } = await import('@/components/ui/avatar');
  record('Avatar (standard with fallback)', () => {
    const html = renderToString(
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
        <AvatarFallback>DF</AvatarFallback>
      </Avatar>
    );
    if (!html.includes('DF')) throw new Error('Avatar fallback missing in SSR output');
  });

  // 2. Badge
  const { Badge } = await import('@/components/ui/badge');
  record('Badge (all 4 variants)', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline'] as const;
    for (const v of variants) {
      const html = renderToString(<Badge variant={v}>{`Badge-${v}`}</Badge>);
      if (!html.includes(`Badge-${v}`)) throw new Error(`Badge variant ${v} rendered empty`);
    }
  });

  // 3. Button
  const { Button } = await import('@/components/ui/button');
  record('Button (all variants & sizes, disabled state)', () => {
    const variants = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;
    const sizes = ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'] as const;
    for (const v of variants) {
      for (const s of sizes) {
        const html = renderToString(
          <Button variant={v} size={s} disabled>
            {`Btn-${v}-${s}`}
          </Button>
        );
        if (!html.includes(`Btn-${v}-${s}`)) throw new Error(`Button ${v}/${s} rendered empty`);
      }
    }
  });

  // 4. Card
  const { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } = await import('@/components/ui/card');
  record('Card (full composite structure)', () => {
    const html = renderToString(
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
          <CardAction>
            <Button size="sm">Action</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>Body Content</p>
        </CardContent>
        <CardFooter>
          <span>Footer text</span>
        </CardFooter>
      </Card>
    );
    if (!html.includes('Card Title') || !html.includes('Body Content')) {
      throw new Error('Card composite content missing in SSR');
    }
  });

  // 5. Dialog
  const { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } = await import('@/components/ui/dialog');
  record('Dialog (trigger & subcomponents SSR rendering)', () => {
    // Closed state trigger
    const htmlClosed = renderToString(
      <Dialog>
        <DialogTrigger render={<Button>Open Dialog</Button>} />
      </Dialog>
    );
    if (!htmlClosed.includes('Open Dialog')) throw new Error('Dialog trigger missing in SSR');

    // Subcomponents SSR rendering within Dialog root
    const htmlHeader = renderToString(
      <Dialog>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>Dialog Description</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Close</Button>
        </DialogFooter>
      </Dialog>
    );
    if (!htmlHeader.includes('Dialog Title') || !htmlHeader.includes('Dialog Description')) {
      throw new Error('Dialog header components failed SSR');
    }

    // Verify open Dialog does not throw during SSR
    renderToString(
      <Dialog open={true}>
        <DialogContent>
          <DialogTitle>Modal</DialogTitle>
        </DialogContent>
      </Dialog>
    );
  });

  // 6. DropdownMenu
  const {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
  } = await import('@/components/ui/dropdown-menu');
  record('DropdownMenu (trigger & subcomponents SSR rendering)', () => {
    // Closed state
    const htmlClosed = renderToString(
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>Actions</Button>} />
      </DropdownMenu>
    );
    if (!htmlClosed.includes('Actions')) throw new Error('DropdownMenu trigger missing in SSR');

    // Subcomponents within DropdownMenu root
    const htmlItems = renderToString(
      <DropdownMenu>
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
        </DropdownMenuGroup>
      </DropdownMenu>
    );
    if (!htmlItems.includes('My Account')) {
      throw new Error('DropdownMenu subcomponents failed SSR');
    }

    // Verify open DropdownMenu does not throw during SSR
    renderToString(
      <DropdownMenu open={true}>
        <DropdownMenuTrigger render={<Button>Actions</Button>} />
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  });

  // 7. Input
  const { Input } = await import('@/components/ui/input');
  record('Input (various types and states)', () => {
    const types = ['text', 'email', 'password', 'file', 'number'] as const;
    for (const t of types) {
      const html = renderToString(<Input type={t} placeholder={`Enter ${t}`} defaultValue="test-val" disabled={t === 'file'} />);
      if (!html.includes(`type="${t}"`)) throw new Error(`Input type ${t} failed SSR`);
    }
  });

  // 8. Label
  const { Label } = await import('@/components/ui/label');
  record('Label (with htmlFor)', () => {
    const html = renderToString(<Label htmlFor="input-email">Email Address</Label>);
    if (!html.includes('for="input-email"') || !html.includes('Email Address')) {
      throw new Error('Label failed SSR');
    }
  });

  // 9. Progress
  const { Progress } = await import('@/components/ui/progress');
  record('Progress (various values)', () => {
    const values = [0, 25, 50, 75, 100, undefined];
    for (const v of values) {
      const html = renderToString(<Progress value={v ?? null} className="w-full" />);
      if (!html.includes('data-slot="progress"')) throw new Error(`Progress value ${v} failed SSR`);
    }
  });

  // 10. Select
  const {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectGroup,
    SelectLabel,
    SelectItem,
    SelectSeparator,
  } = await import('@/components/ui/select');
  record('Select (trigger & subcomponents SSR rendering)', () => {
    // Closed state
    const htmlClosed = renderToString(
      <Select defaultValue="apple">
        <SelectTrigger>
          <SelectValue placeholder="Choose a fruit" />
        </SelectTrigger>
      </Select>
    );
    if (!htmlClosed.includes('data-slot="select-trigger"')) throw new Error('Select trigger missing in SSR');

    // Subcomponents within Select root
    const htmlGroup = renderToString(
      <Select defaultValue="apple">
        <SelectGroup>
          <SelectLabel>Fruits</SelectLabel>
          <SelectSeparator />
        </SelectGroup>
      </Select>
    );
    if (!htmlGroup.includes('Fruits')) {
      throw new Error('Select group subcomponents failed SSR');
    }

    // Verify open Select does not throw during SSR
    renderToString(
      <Select defaultValue="banana" open={true}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>
    );
  });

  // 11. Separator
  const { Separator } = await import('@/components/ui/separator');
  record('Separator (horizontal and vertical)', () => {
    const htmlH = renderToString(<Separator orientation="horizontal" />);
    const htmlV = renderToString(<Separator orientation="vertical" />);
    if (!htmlH.includes('data-orientation="horizontal"') || !htmlV.includes('data-orientation="vertical"')) {
      throw new Error('Separator orientation missing in SSR');
    }
  });

  // 12. Sheet
  const {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose,
  } = await import('@/components/ui/sheet');
  record('Sheet (trigger & subcomponents SSR rendering)', () => {
    // Closed state
    const htmlClosed = renderToString(
      <Sheet>
        <SheetTrigger render={<Button>Open Drawer</Button>} />
      </Sheet>
    );
    if (!htmlClosed.includes('Open Drawer')) throw new Error('Sheet trigger missing in SSR');

    // Subcomponents within Sheet root
    const htmlHeader = renderToString(
      <Sheet>
        <SheetHeader>
          <SheetTitle>Sheet Title</SheetTitle>
          <SheetDescription>Description text</SheetDescription>
        </SheetHeader>
      </Sheet>
    );
    if (!htmlHeader.includes('Sheet Title') || !htmlHeader.includes('Description text')) {
      throw new Error('Sheet header subcomponents failed SSR');
    }

    // Verify open Sheet does not throw during SSR across sides
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    for (const side of sides) {
      renderToString(
        <Sheet open={true}>
          <SheetContent side={side}>
            <SheetTitle>{`Sheet on ${side}`}</SheetTitle>
          </SheetContent>
        </Sheet>
      );
    }
  });

  // 13. Table
  const {
    Table,
    TableHeader,
    TableBody,
    TableFooter,
    TableHead,
    TableRow,
    TableCell,
    TableCaption,
  } = await import('@/components/ui/table');
  record('Table (full semantic tabular structure)', () => {
    const html = renderToString(
      <Table>
        <TableCaption>A list of hackathon submissions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Track</TableHead>
            <TableHead>Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>DogFood Portal</TableCell>
            <TableCell>DevTools</TableCell>
            <TableCell>9.8</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Average</TableCell>
            <TableCell>9.8</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    if (!html.includes('DogFood Portal') || !html.includes('DevTools') || !html.includes('9.8')) {
      throw new Error('Table data missing in SSR');
    }
  });

  // 14. Tabs
  const { Tabs, TabsList, TabsTrigger, TabsContent } = await import('@/components/ui/tabs');
  record('Tabs (multiple triggers & active content)', () => {
    const html = renderToString(
      <Tabs defaultValue="submissions" className="w-full">
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="judging">Judging</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">Submissions List Content</TabsContent>
        <TabsContent value="judging">Judging Matrix Content</TabsContent>
        <TabsContent value="analytics">Analytics Dashboard Content</TabsContent>
      </Tabs>
    );
    if (!html.includes('Submissions') || !html.includes('Submissions List Content')) {
      throw new Error('Tabs content missing in SSR');
    }
  });

  // 15. Textarea
  const { Textarea } = await import('@/components/ui/textarea');
  record('Textarea (normal and disabled states)', () => {
    const html = renderToString(
      <Textarea placeholder="Enter judge comments..." defaultValue="Great work!" rows={4} disabled={false} />
    );
    if (!html.includes('Great work!') || !html.includes('Enter judge comments...')) {
      throw new Error('Textarea failed SSR');
    }
  });

  // 16. Composed Multi-Component Page Integration
  record('Composed Multi-Component Integration Page', () => {
    const html = renderToString(
      <div className="p-6 space-y-6 bg-background text-foreground">
        <header className="flex justify-between items-center border-b pb-4">
          <h1 className="text-xl font-bold">DOGFOOD 2026 Hackathon Portal</h1>
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
            <Badge variant="secondary">Admin</Badge>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>System Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="prog">Judging Progress</Label>
              <Progress id="prog" value={68} />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Input placeholder="Search projects..." />
              <Button>Filter</Button>
            </div>
          </CardContent>
        </Card>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Alpha</TableCell>
              <TableCell><Badge variant="default">Evaluated</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
    if (!html.includes('DOGFOOD 2026 Hackathon Portal') || !html.includes('Judging Progress')) {
      throw new Error('Composed page integration failed SSR');
    }
  });

  console.log('\n--- SSR Stress Test Summary ---');
  console.table(testResults);

  if (failures > 0) {
    console.error(`\nFAILED: ${failures} component test(s) failed during SSR!`);
    process.exit(1);
  } else {
    console.log(`\nALL ${testResults.length} SSR COMPONENT TESTS PASSED WITH 0 ERRORS!`);
    process.exit(0);
  }
}

runSSRStressTests();
