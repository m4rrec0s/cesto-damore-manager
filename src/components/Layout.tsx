import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { Button } from "./ui/button";
import logo from "../assets/logocestodamore.png";
import { ManagerSidebar } from "./sidebar/ManagerSidebar";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "./animate-ui/components/radix/sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <SidebarProvider defaultOpen className="min-h-screen w-full">
      <Sidebar collapsible="icon" className="border-r border-neutral-200">
        <SidebarHeader>
          <div className="flex items-center gap-3 px-2 py-2">
            <img src={logo} alt="Cesto D'Amore Logo" className="w-10 h-auto" />
          </div>
        </SidebarHeader>
        <SidebarSeparator />

        <ManagerSidebar />

        <SidebarFooter>
          <div className="space-y-3">
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
              className="w-full flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Sair
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset
        className={
          path.startsWith("/layouts/editor") ? "bg-[#0d1216]" : "bg-neutral-100"
        }
      >
        <header className="flex h-14 items-center gap-2 border-b border-neutral-200 bg-white px-4">
          <SidebarTrigger className="-ml-1" />
          <span className="text-sm font-semibold text-neutral-900">
            Cesto D'Amore
          </span>
        </header>

        <main
          className={`flex-1 min-h-0 ${path.startsWith("/service") ? "overflow-hidden" : "overflow-auto"}`}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
