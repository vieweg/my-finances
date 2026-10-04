import { Navigate } from "react-router-dom";
import { LoginForm } from "@/features/auth/components";
import { useSetupStatus } from "@/features/auth";

export default function LoginPage() {
  const { data: status, isPending } = useSetupStatus();

  if (isPending) return null;
  // Before the first account exists there is nobody to log in as
  if (status?.needsSetup) return <Navigate to="/setup" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Finances 3.0</h1>
        <LoginForm />
      </div>
    </div>
  );
}
