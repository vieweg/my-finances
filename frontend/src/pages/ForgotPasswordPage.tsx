import { useState } from "react";
import { Link } from "react-router-dom";
import { useForgotPassword } from "@/features/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const forgotPassword = useForgotPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await forgotPassword.mutateAsync(email);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Finances 3.0</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Reset your password
        </p>

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-700">
              If an account with that email exists, you'll receive a reset link
              shortly. Check your inbox (and spam folder).
            </p>
            <Link
              to="/login"
              className="inline-block text-sm text-blue-600 hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm  text-gray-700 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>

            {forgotPassword.error && (
              <p className="text-sm text-red-600">
                {forgotPassword.error.message}
              </p>
            )}

            <button
              type="submit"
              disabled={forgotPassword.isPending || !email.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
            >
              {forgotPassword.isPending ? "Sending..." : "Send reset link"}
            </button>

            <p className="text-center text-sm text-gray-500">
              <Link to="/login" className="text-blue-600 hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
