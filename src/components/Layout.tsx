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
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
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
  { name: "Atendimento", href: "/service", icon: BotMessageSquare },
  { name: "Design Editor", href: "/layouts", icon: Palette },
];

export function Layout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

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
        fixed md:static top-0 left-0 z-50 h-dvh w-fit md:h-full overflow-hidden border-r border-neutral-200 transform transition-all duration-300 ease-in-out bg-white
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full "} 
        md:translate-x-0 md: 
      `}
      >
        <div className="h-full flex flex-col p-3">
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Cesto D'Amore Logo" className="w-12 h-auto" />
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
                    flex flex-col items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium text-xs  justify-start
                    ${
                      isActive
                        ? "bg-neutral-600 text-white shadow-lg shadow-neutral-200"
                        : "text-neutral-900/70 hover:bg-neutral-100 hover:text-neutral-900"
                    }
                    gap-3
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

          <div
            className={`mt-auto mx-auto pt-6 border-t border-neutral-300 space-y-4`}
          >
            <div className="flex items-center border-2 border-blue-400 rounded-full">
              {user?.image_url ? (
                <img
                  src={user.image_url}
                  alt={user.name || "User"}
                  className="rounded-full max-w-12 object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="rounded-full max-w-12 bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            <Button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 rounded-xl text-neutral-100 hover:bg-neutral-500 transition-colors font-medium"
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${
          path.startsWith("/layouts/editor") ? "bg-[#0d1216]" : "bg-neutral-100"
        }`}
      >
        <div className="md:hidden flex items-center gap-4 px-6 py-4 bg-white border-b border-neutral-200">
          <Button
            type="button"
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

        <main className="flex-1 overflow-auto">
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
