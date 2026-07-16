"use client";

import { useAuth, Role } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in
        router.push("/login");
      } else if (profile) {
        // Logged in and profile loaded
        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
          // Does not have required role
          router.push("/unauthorized"); // Or dashboard
        } else {
          setIsAuthorized(true);
        }
      } else {
        // Logged in but profile not found in DB
        // Wait or handle error?
      }
    }
  }, [user, profile, loading, router, allowedRoles]);

  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return <>{children}</>;
}
