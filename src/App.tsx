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
import { LayoutEditor } from "./pages/LayoutEditor";
import { DesignEditor } from "./components/editor/DesignEditor";
import DesignEditorPage from "./pages/DesignEditorPage";
import { NewDesignPage } from "./pages/NewDesignPage";
import DesignTestPage from "./pages/DesignTestPage";

export default function App() {
  return (
    <>
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
              <LayoutEditor />
            </AdminRoute>
          }
        />
        <Route
          path="/layouts/new"
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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
