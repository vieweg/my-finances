import { useState, useEffect, lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/store/auth";
import { refreshAccessToken } from "@/api/client";
import ErrorPage from "@/pages/ErrorPage";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SetupPage = lazy(() => import("@/pages/SetupPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const TransactionDetailPage = lazy(() => import("@/pages/TransactionDetailPage"));
const WalletsPage = lazy(() => import("@/pages/WalletsPage"));
const WalletDetailPage = lazy(() => import("@/pages/WalletDetailPage"));
const TagsPage = lazy(() => import("@/pages/TagsPage"));
const ContactsPage = lazy(() => import("@/pages/ContactsPage"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const InvoiceDetailPage = lazy(() => import("@/pages/InvoiceDetailPage"));
const ContractsPage = lazy(() => import("@/pages/ContractsPage"));
const ContractDetailPage = lazy(() => import("@/pages/ContractDetailPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const [checking, setChecking] = useState(!token);

  useEffect(() => {
    if (token) {
      setChecking(false);
      return;
    }
    refreshAccessToken().finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const PageSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

export const router = createBrowserRouter([
  { path: "/login", element: <Suspense fallback={<PageSpinner />}><LoginPage /></Suspense>, errorElement: <ErrorPage /> },
  { path: "/setup", element: <Suspense fallback={<PageSpinner />}><SetupPage /></Suspense>, errorElement: <ErrorPage /> },
  { path: "/forgot-password", element: <Suspense fallback={<PageSpinner />}><ForgotPasswordPage /></Suspense>, errorElement: <ErrorPage /> },
  { path: "/reset-password", element: <Suspense fallback={<PageSpinner />}><ResetPasswordPage /></Suspense>, errorElement: <ErrorPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <ErrorPage />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/transactions/:id", element: <TransactionDetailPage /> },
          { path: "/wallets", element: <WalletsPage /> },
          { path: "/wallets/:id", element: <WalletDetailPage /> },
          { path: "/tags", element: <TagsPage /> },
          { path: "/contacts", element: <ContactsPage /> },
          { path: "/invoices", element: <InvoicesPage /> },
          { path: "/invoices/:id", element: <InvoiceDetailPage /> },
          { path: "/contracts", element: <ContractsPage /> },
          { path: "/contracts/:id", element: <ContractDetailPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
]);
