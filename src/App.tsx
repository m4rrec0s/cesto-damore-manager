import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminRoute } from "./contexts/AdminRoute";
import { useAuth } from "./contexts/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Dashboard } from "./pages/Dashboard";
import { Toaster } from "sonner";
import { Orders } from "./pages/Orders";
import { Catalog } from "./pages/Catalog";
import { Items } from "./pages/Items";
import { Categories } from "./pages/Categories";
import { Types } from "./pages/Types";
import { Feed } from "./pages/Feed";
import { Service } from "./pages/Service";
import { Holidays } from "./pages/Holidays";
import { FollowUp } from "./pages/FollowUp";
import DesignEditorPage from "./pages/DesignEditorPage";
import { NewDesignPage } from "./pages/NewDesignPage";
import DesignTestPage from "./pages/DesignTestPage";
import { LlmTestSessionPage } from "./pages/LlmTestSessionPage";
import { LlmPromptPriorityPage } from "./pages/LlmPromptPriorityPage";
import { LlmKnowledgeDocsPage } from "./pages/LlmKnowledgeDocsPage";
import { ObsidianKnowledgePage } from "./pages/ObsidianKnowledgePage";
import BotFlowPage from "./pages/BotFlowPage";
import { BotChatTest } from "./pages/BotChatTest";
import { UIProvider } from "./contexts/UIContext";
import { StockManager } from "./pages/StockManager";
import { AgentLogsPage } from "./pages/AgentLogsPage";
import { useOrderNotifications } from "./hooks/useOrderNotifications";

import { ManualPrintOrder } from "./pages/ManualPrintOrder";
import { DevicesPage } from "./pages/DevicesPage";

export default function App() {
  const { user } = useAuth();
  const {
    permission,
    enabled,
    requestPermission,
    startPolling,
  } = useOrderNotifications();

  useEffect(() => {
    // Só solicita permissão se o usuário estiver autenticado
    if (!user) return;

    // Solicitar permissão apenas se ainda não foi solicitada
    if (permission.status === "default" && !permission.requested) {
      // Aguarda 2 segundos e solicita permissão
      const timer = setTimeout(() => {
        requestPermission().then((granted) => {
          if (granted) {
            startPolling();
          }
        });
      }, 2000);

      return () => clearTimeout(timer);
    } else if (permission.status === "granted" && !enabled) {
      // Se já tem permissão mas não está ativo, iniciar
      startPolling();
    }
  }, [user, permission.status, permission.requested, enabled, requestPermission, startPolling]);

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
          element={<Navigate to="/catalog/products" replace />}
        />
        <Route
          path="/catalog/products"
          element={
            <AdminRoute>
              <Catalog />
            </AdminRoute>
          }
        />
        <Route
          path="/catalog/items"
          element={
            <AdminRoute>
              <Items />
            </AdminRoute>
          }
        />
        <Route
          path="/catalog/categories"
          element={
            <AdminRoute>
              <Categories />
            </AdminRoute>
          }
        />
        <Route
          path="/catalog/types"
          element={
            <AdminRoute>
              <Types />
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
          path="/service/:sessionId"
          element={
            <AdminRoute>
              <Service />
            </AdminRoute>
          }
        />
        <Route path="/ai" element={<Navigate to="/ai/bot-flow" replace />} />
        <Route
          path="/ai/llm-test"
          element={
            <AdminRoute>
              <LlmTestSessionPage />
            </AdminRoute>
          }
        />
        <Route
          path="/ai/llm-prompt-priority"
          element={
            <AdminRoute>
              <LlmPromptPriorityPage />
            </AdminRoute>
          }
        />
        <Route
          path="/ai/obsidian-knowledge"
          element={
            <AdminRoute>
              <ObsidianKnowledgePage />
            </AdminRoute>
          }
        />
        <Route
          path="/ai/llm-knowledge"
          element={
            <AdminRoute>
              <LlmKnowledgeDocsPage />
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
        <Route
          path="/stock-manager"
          element={
            <AdminRoute>
              <StockManager />
            </AdminRoute>
          }
        />
        <Route
          path="/ai/bot-flow"
          element={
            <AdminRoute>
              <BotFlowPage />
            </AdminRoute>
          }
        />
        
        {/* Agent Logs Viewer */}
        <Route
          path="/ai/agent-logs"
          element={
            <AdminRoute>
              <AgentLogsPage />
            </AdminRoute>
          }
        />

        <Route
          path="/impressao/manual"
          element={
            <AdminRoute>
              <ManualPrintOrder />
            </AdminRoute>
          }
        />

        {/* Redirect old printers page to devices */}
        <Route path="/settings/printers" element={<Navigate to="/settings/devices" replace />} />

        {/* Print Devices */}
        <Route
          path="/settings/devices"
          element={
            <AdminRoute>
              <DevicesPage />
            </AdminRoute>
          }
        />

        {/* Fallback routes for backward compatibility with new conversation format */}
        <Route path="/ai/bot-test" element={<AdminRoute><BotChatTest /></AdminRoute>} />
        
        {/* Old path redirects to new paths */}
        <Route path="/llm-test" element={<Navigate to="/ai/llm-test" replace />} />
        <Route path="/llm-prompt-priority" element={<Navigate to="/ai/llm-prompt-priority" replace />} />
        <Route path="/obsidian-knowledge" element={<Navigate to="/ai/obsidian-knowledge" replace />} />
        <Route path="/llm-knowledge" element={<Navigate to="/ai/llm-knowledge" replace />} />
        <Route path="/bot-flow" element={<Navigate to="/ai/bot-flow" replace />} />
        <Route path="/bot-test" element={<Navigate to="/ai/bot-test" replace />} />
        <Route path="/agent-logs" element={<Navigate to="/ai/agent-logs" replace />} />
        
        {/* Catch-all fallback for conversation format compatibility */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </UIProvider>
  );
}
