import React from 'react';

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-[#07090e] text-slate-100 antialiased p-0 m-0">
      {children}
    </div>
  );
}
