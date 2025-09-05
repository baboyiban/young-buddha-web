// components/ClientShell.tsx (업데이트된 버전)
"use client";

import AppLayout from "@/components/AppLayout";
import AppProviders from "@/components/providers/AppProviders";
import { Toaster } from "react-hot-toast";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProviders>
      <Toaster />
      <AppLayout>{children}</AppLayout>
    </AppProviders>
  );
}
