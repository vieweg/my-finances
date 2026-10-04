import { LoginForm } from "@/features/auth/components";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Finances 3.0</h1>
        <LoginForm />
      </div>
    </div>
  );
}
