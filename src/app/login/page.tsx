'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

const TEST_ACCOUNTS = [
  { role: 'Organizer', email: 'organizer@dogfood.dev', desc: 'Admin & export controls' },
  { role: 'Judge A', email: 'judge_a@dogfood.dev', desc: 'Scoring & peer evaluations' },
  { role: 'Judge B', email: 'judge_b@dogfood.dev', desc: 'Peer isolation evaluation' },
  { role: 'Participant', email: 'participant@dogfood.dev', desc: 'Project submissions' },
];

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter an email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Hard navigation ensures browser and Server Components reload with new session cookie
      window.location.href = '/projects';
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-muted/20 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary mb-2">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">DOGFOOD 2026</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your hackathon portal</p>
        </div>

        {/* Login Card */}
        <Card className="border shadow-sm bg-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your registered hackathon email address.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Seeded Test Accounts Quick Select */}
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                  <span>Quick-select seeded test accounts:</span>
                  <Badge variant="outline" className="text-[10px] py-0">Demo</Badge>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {TEST_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => setEmail(acc.email)}
                      className="text-left p-2.5 rounded-lg border bg-background hover:bg-muted/60 transition-colors text-xs flex flex-col gap-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span className="font-semibold text-foreground text-xs">{acc.role}</span>
                      <span className="text-[10px] text-muted-foreground truncate w-full">{acc.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>

              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline mx-auto"
              >
                <ArrowLeft className="size-3" />
                <span>Return to Public Gallery</span>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
