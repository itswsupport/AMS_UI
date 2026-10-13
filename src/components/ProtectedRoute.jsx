import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/permissions";

export function ProtectedRoute({ children, permission, fallback = null, redirectTo = "/Login/" }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push(redirectTo);
  }, [user, loading, router, redirectTo]);

  if (loading) return <div>Loading...</div>;
  if (!user) return fallback;

  if (permission && !hasPermission(user, permission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

export function ProtectedRouteAny({ children, permissions = [], fallback = null, redirectTo = "/Login/" }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push(redirectTo);
  }, [user, loading, router, redirectTo]);

  if (loading) return <div>Loading...</div>;
  if (!user) return fallback;

  if (permissions.length > 0 && !hasAnyPermission(user, permissions)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

export function ProtectedRouteAll({ children, permissions = [], fallback = null, redirectTo = "/Login/" }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push(redirectTo);
  }, [user, loading, router, redirectTo]);

  if (loading) return <div>Loading...</div>;
  if (!user) return fallback;

  if (permissions.length > 0 && !hasAllPermissions(user, permissions)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

export function usePermissions() {
  const { user } = useAuth();
  return {
    hasPermission: (permission) => hasPermission(user, permission),
    hasAnyPermission: (permissions) => hasAnyPermission(user, permissions),
    hasAllPermissions: (permissions) => hasAllPermissions(user, permissions),
    user,
  };
}
