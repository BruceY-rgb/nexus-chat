"use client";

// =====================================================
// Authentication Context
// =====================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@prisma/client";

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  realName?: string;
  avatarUrl?: string;
  status: string;
  role: string;
  isOnline: boolean;
  lastSeenAt?: Date;
  timezone?: string;
  notificationSettings?: {
    mentionInChannel: boolean;
    mentionInDm: boolean;
    browserPush: boolean;
    emailEnabled: boolean;
  };
}

interface LoginData {
  email: string;
  password?: string;
  code?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => void;
}

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  realName?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user information
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      console.log("🔵 [AUTH] Fetching current user information...");

      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      console.log(
        "🟡 [AUTH] me response status:",
        response.status,
        response.statusText,
      );

      if (response.ok) {
        const data = await response.json();
        console.log("🟢 [AUTH] Successfully fetched user information:", data);
        setUser(data.data.user);
      } else {
        console.log("🟡 [AUTH] Not logged in or session expired");
        setUser(null);
      }
    } catch (error) {
      console.error("🔴 [AUTH] Failed to get user information:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (loginData: LoginData) => {
    try {
      console.log("🔵 [AUTH] Attempting login:", {
        email: loginData.email,
        mode: loginData.code ? "verification" : "password",
      });

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(loginData),
      });

      console.log(
        "🟡 [AUTH] Response status:",
        response.status,
        response.statusText,
      );

      // First check if response is ok
      if (!response.ok) {
        // If not ok, try to get error text
        const errorText = await response.text();
        console.error("🔴 [AUTH] Response error:", errorText);

        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          // Extract specific validation error messages if available
          if (errorData.details?.errors) {
            const errorMessages = Object.values(errorData.details.errors).filter(Boolean);
            if (errorMessages.length > 0) {
              throw new Error(errorMessages.join('. '));
            }
          }
          throw new Error(
            errorData.message || `Login failed (${response.status})`,
          );
        } catch (parseError) {
          // Re-throw if it's already our Error
          if (parseError instanceof Error && parseError.message !== errorText) {
            throw parseError;
          }
          // If parsing fails, it means the response is not JSON
          console.error("🔴 [AUTH] Response is not JSON format:", parseError);
          throw new Error(
            `Server returned non-JSON response (${response.status}): ${errorText.substring(0, 200)}`,
          );
        }
      }

      // Response ok, parse JSON
      console.log("🟢 [AUTH] Response successful, parsing JSON...");
      const data = await response.json();
      console.log("🟢 [AUTH] User data:", data);

      if (!data.data || !data.data.user) {
        console.error("🔴 [AUTH] Response format error:", data);
        throw new Error("Response format error");
      }

      setUser(data.data.user);
      console.log("🟢 [AUTH] Login successful");
    } catch (error: any) {
      console.error("🔴 [AUTH] Login process error:", error);
      throw error;
    }
  };

  const register = async (registerData: RegisterData) => {
    try {
      console.log("🔵 [AUTH] Attempting registration:", {
        email: registerData.email,
        displayName: registerData.displayName,
      });

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(registerData),
      });

      console.log(
        "🟡 [AUTH] Registration response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🔴 [AUTH] Registration response error:", errorText);

        try {
          const errorData = JSON.parse(errorText);
          // Extract specific validation error messages if available
          if (errorData.details?.errors) {
            const errorMessages = Object.values(errorData.details.errors).filter(Boolean);
            if (errorMessages.length > 0) {
              throw new Error(errorMessages.join('. '));
            }
          }
          throw new Error(
            errorData.message || `Registration failed (${response.status})`,
          );
        } catch (parseError) {
          // Re-throw if it's already our Error
          if (parseError instanceof Error && parseError.message !== errorText) {
            throw parseError;
          }
          console.error(
            "🔴 [AUTH] Registration response is not JSON format:",
            parseError,
          );
          throw new Error(
            `Server returned non-JSON response (${response.status}): ${errorText.substring(0, 200)}`,
          );
        }
      }

      const data = await response.json();
      console.log("🟢 [AUTH] Registration successful:", data);

      if (!data.data || !data.data.user) {
        console.error("🔴 [AUTH] Registration response format error:", data);
        throw new Error("Response format error");
      }

      setUser(data.data.user);
      console.log("🟢 [AUTH] User has been set");
    } catch (error: any) {
      console.error("🔴 [AUTH] Registration process error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
