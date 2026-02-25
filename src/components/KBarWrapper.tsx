'use client';

import GlobalSearchModal from "./GlobalSearchModal";
import { GlobalSearchProvider } from "@/hooks/GlobalSearchContext";

interface KBarWrapperProps {
  children: React.ReactNode;
}

export default function KBarWrapper({ children }: KBarWrapperProps) {
  return (
    <GlobalSearchProvider>
      {children}
      <GlobalSearchModal />
    </GlobalSearchProvider>
  );
}
