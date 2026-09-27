import React from 'react';
import { renderToString } from 'react-dom/server';

(globalThis as any).React = React;

async function debug() {
  const { Badge } = await import('@/components/ui/badge');
  const badgeHtml = renderToString(<Badge>Test Badge Text</Badge>);
  console.log('Badge HTML:', JSON.stringify(badgeHtml));

  const { Button } = await import('@/components/ui/button');
  const buttonHtml = renderToString(<Button>Test Button Text</Button>);
  console.log('Button HTML:', JSON.stringify(buttonHtml));
}

debug();
