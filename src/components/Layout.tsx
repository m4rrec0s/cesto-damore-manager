import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Box,
  PackageCheck,
  BotMessageSquare,
  LogOut,
  User as UserIcon,
  Palette,
  Menu,
  X,
  Calendar,
  RefreshCw,
  TestTube2,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useUI } from "../contexts/UIContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import logo from "../assets/logocestodamore.png";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Pedidos", href: "/orders", icon: ClipboardList },
  {
    name: "Catálogo",
    href: "/catalog",
    icon: Box,
    submenu: [
      { name: "Produtos", href: "/catalog" },
      { name: "Itens", href: "/items" },
      { name: "Categorias", href: "/categories" },
      { name: "Tipos", href: "/types" },
    ],
  },
  { name: "Feed", href: "/feed", icon: PackageCheck },
  { name: "CestoBot", href: "/bot-flow", icon: BotMessageSquare },
  { name: "Teste do Bot", href: "/bot-test", icon: TestTube2 },
  { name: "Feriados", href: "/holidays", icon: Calendar },
  { name: "Follow-up", href: "/follow-up", icon: RefreshCw },
  { name: "Design Editor", href: "/layouts", icon: Palette },
];

export function Layout({ children }: { children: ReactNode }) {
  const { isSidebarOpen, setIsSidebarOpen } = useUI();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  // Garante que a sidebar esteja sempre aberta em telas grandes, exceto no editor
  useEffect(() => {
    if (!path.startsWith("/layouts/editor")) {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    }
  }, [path, setIsSidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`
        fixed md:static top-0 left-0 z-50 h-dvh w-72 md:w-64 md:h-full border-r border-neutral-200 transform transition-all duration-300 ease-in-out bg-white
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} 
        md:translate-x-0 
      `}
      >
        <div className="h-full min-h-0 flex flex-col p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-3 border-b border-neutral-200">
            <img src={logo} alt="Cesto D'Amore Logo" className="w-10 h-auto" />
            <div className="text-sm font-semibold text-neutral-900">
              Cesto D'Amore
            </div>
          </div>
          <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-1.5 pr-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm
                    ${
                      isActive
                        ? "bg-neutral-600 text-white shadow-lg shadow-neutral-200"
                        : "text-neutral-900/70 hover:bg-neutral-100 hover:text-neutral-900"
                    }
                  `}
                  title={item.name || undefined}
                >
                  <item.icon size={20} className="shrink-0" />
                  <span className="transition-all duration-300 overflow-hidden">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 pt-3 border-t border-neutral-300 space-y-3 shrink-0">
            <div className="flex items-center gap-3 px-2">
              {user?.image_url ? (
                <img
                  src={user.image_url}
                  alt={user.name || "User"}
                  className="rounded-full w-10 h-10 object-cover shrink-0 border border-neutral-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="rounded-full w-10 h-10 bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0 border border-neutral-200">
                  <UserIcon size={18} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">
                  {user?.name || "Administrador"}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {user?.email || ""}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-neutral-100 hover:bg-neutral-500 transition-colors font-medium"
            >
              <LogOut size={20} />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${path.startsWith("/layouts/editor") ? "bg-[#0d1216]" : "bg-neutral-100"}`}
      >
        <div className="md:hidden flex items-center gap-4 px-6 py-4 bg-white border-b border-neutral-200">
          <Button
            type="button"
            variant={"ghost"}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <X size={24} className="text-neutral-700" />
            ) : (
              <Menu size={24} className="text-neutral-700" />
            )}
          </Button>
          <h1 className="font-bold text-neutral-950">Cesto D'Amore</h1>
        </div>

        <main
          className={`flex-1 min-h-0 ${path.startsWith("/service") ? "overflow-hidden" : "overflow-auto"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
