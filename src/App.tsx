import { Routes, Route, Navigate } from "react-router-dom";
import { AdminRoute } from "./contexts/AdminRoute";
import { LoginForm } from "./components/LoginForm";
import { Dashboard } from "./pages/Dashboard";
import { Toaster } from "sonner";
import { Orders } from "./pages/Orders";
import { Catalog } from "./pages/Catalog";
import { Items } from "./pages/Items";
import { Categories } from "./pages/Categories";
// import { Types } from "./pages/Types";
import { Feed } from "./pages/Feed";
import { Service } from "./pages/Service";
import { Holidays } from "./pages/Holidays";
import { FollowUp } from "./pages/FollowUp";
import DesignEditorPage from "./pages/DesignEditorPage";
import { NewDesignPage } from "./pages/NewDesignPage";
import DesignTestPage from "./pages/DesignTestPage";
import { UIProvider } from "./contexts/UIContext";

export default function App() {
  return (
    <UIProvider>
      <Toaster
        position="top-right"
        richColors
        toastOptions={{
          style: { borderRadius: "1.5rem", padding: "1rem", fontWeight: "600" },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginForm />} />

        <Route
          path="/"
          element={
            <AdminRoute>
              <Dashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <AdminRoute>
              <Orders />
            </AdminRoute>
          }
        />
        <Route
          path="/catalog"
          element={
            <AdminRoute>
              <Catalog />
            </AdminRoute>
          }
        />
        <Route
          path="/products"
          element={
            <AdminRoute>
              <Catalog />
            </AdminRoute>
          }
        />
        <Route
          path="/items"
          element={
            <AdminRoute>
              <Items />
            </AdminRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <AdminRoute>
              <Categories />
            </AdminRoute>
          }
        />
        <Route
          path="/layouts"
          element={
            <AdminRoute>
              <NewDesignPage />
            </AdminRoute>
          }
        />
        <Route
          path="/layouts/editor/:layoutId"
          element={
            <AdminRoute>
              <DesignEditorPage />
            </AdminRoute>
          }
        />
        <Route
          path="/design-test/:layoutId"
          element={
            <AdminRoute>
              <DesignTestPage />
            </AdminRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <AdminRoute>
              <Feed />
            </AdminRoute>
          }
        />
        <Route
          path="/service"
          element={
            <AdminRoute>
              <Service />
            </AdminRoute>
          }
        />
        <Route
          path="/holidays"
          element={
            <AdminRoute>
              <Holidays />
            </AdminRoute>
          }
        />
        <Route
          path="/follow-up"
          element={
            <AdminRoute>
              <FollowUp />
            </AdminRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </UIProvider>
  );
}
