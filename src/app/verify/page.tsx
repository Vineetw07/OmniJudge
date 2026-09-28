import { Metadata } from 'next';
import { verifyCertificateToken } from '@/lib/certificates';
import { VerifyClient } from './verify-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verify Judge Record | OmniJudge',
  description: 'Cryptographically verify digital judge participation credentials and evaluation records.',
};

interface VerifyPageProps {
  searchParams?: {
    record?: string;
  };
}

export default function VerifyPage({ searchParams }: VerifyPageProps) {
  const token = searchParams?.record || '';
  const initialResult = token ? verifyCertificateToken(token) : null;

  return <VerifyClient initialResult={initialResult} initialToken={token} />;
}
