import { Metadata } from 'next';
import { ApiDocsClient } from './api-docs-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'REST API Documentation & Explorer | OmniJudge',
  description: 'Interactive OpenAPI 3.1 REST API specification and developer reference for OmniJudge.',
};

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
