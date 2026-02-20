// =====================================================
// Authentication Hook
// =====================================================

import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";

// Also provides a standalone hook for backward compatibility
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
