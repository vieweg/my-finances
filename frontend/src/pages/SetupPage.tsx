import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useCompleteSetup, useSetupStatus } from "@/features/auth";
import { useAuthStore } from "@/store/auth";

export default function SetupPage() {
  const { data: status, isPending } = useSetupStatus();
  const token = useAuthStore((state) => state.token);
  const completeSetup = useCompleteSetup();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  if (isPending) return null;
  // Once the account exists this page has nothing to do: go to the app, or to login
  if (!status?.needsSetup) return <Navigate to={token ? "/" : "/login"} replace />;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }
    completeSetup.mutate({ name, username, email, password, confirmPassword });
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Controle Caixa</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Welcome! Create your account to get started.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              autoComplete="name"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="username" className={labelClass}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {(validationError || completeSetup.error) && (
            <p className="text-sm text-red-600">
              {validationError || completeSetup.error?.message}
            </p>
          )}

          <button
            type="submit"
            disabled={completeSetup.isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {completeSetup.isPending ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
