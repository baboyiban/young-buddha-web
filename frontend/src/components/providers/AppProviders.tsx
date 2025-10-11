// components/providers/AppProviders.tsx
"use client";

import React from "react";
import { AuthProvider } from "@/lib/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>{children}</AuthProvider>
    </ErrorBoundary>
  );
}
