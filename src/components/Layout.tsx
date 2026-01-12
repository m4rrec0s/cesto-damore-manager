import { useState } from "react";
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
  Layers,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";

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
  { name: "Atendimento", href: "/service", icon: BotMessageSquare },
  { name: "Layouts Base", href: "/layouts", icon: Layers },
];

export function Layout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Sidebar Overlay */}
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

      {/* Sidebar */}
      <aside
        className={`
        fixed md:static top-0 left-0 z-50 w-72 h-dvh md:h-full overflow-hidden border-r border-neutral-200 transform transition-transform duration-300 ease-in-out bg-white
        md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }
      `}
      >
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div>
              <h1 className="font-bold text-neutral-950 text-lg leading-tight">
                Cesto D'Amore
              </h1>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider">
                Manager Panel
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
                    ${
                      isActive
                        ? "bg-neutral-600 text-white shadow-lg shadow-neutral-200"
                        : "text-neutral-900/70 hover:bg-neutral-100 hover:text-neutral-900"
                    }
                  `}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-neutral-100 space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-600">
                <UserIcon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-neutral-950 truncate">
                  {user?.name || "Administrador"}
                </p>
                <p className="text-xs text-neutral-600/70 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-600 hover:bg-neutral-100 transition-colors font-medium"
            >
              <LogOut size={20} />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-neutral-200">
        <div className="md:hidden flex items-center gap-4 px-6 py-4 bg-white border-b border-neutral-200">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <X size={24} className="text-neutral-700" />
            ) : (
              <Menu size={24} className="text-neutral-700" />
            )}
          </button>
          <h1 className="font-bold text-neutral-950">Cesto D'Amore</h1>
        </div>

        <main className="flex-1 p-6 md:p-10 overflow-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
