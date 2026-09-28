'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex-1 flex flex-col w-full"
    >
      {children}
    </motion.div>
  );
}
