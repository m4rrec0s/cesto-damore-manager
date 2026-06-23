import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import type { ComponentType } from "react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../animate-ui/components/radix/sidebar";
import {
  LayoutDashboard,
  ClipboardList,
  Box,
  PackageCheck,
  BotMessageSquare,
  Sparkles,
  BookOpenText,
  TestTube2,
  Calendar,
  RefreshCw,
  Palette,
  BrainCircuit,
  SlidersHorizontal,
  Warehouse,
  ChevronDown,
  Printer,
  Images,
  Ticket,
} from "lucide-react";

type SidebarItem = {
  name: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  children?: { name: string; href: string }[];
  matchPrefixes?: string[];
};

type SidebarGroupConfig = {
  label: string;
  items: SidebarItem[];
};

const groups: SidebarGroupConfig[] = [
  {
    label: "Visão Geral",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Pedidos", href: "/orders", icon: ClipboardList },
      { name: "Feed", href: "/feed", icon: PackageCheck },
    ],
  },
  {
    label: "Catalogo",
    items: [
      {
        name: "Catalogo",
        href: "/catalog/products",
        icon: Box,
        matchPrefixes: ["/catalog/"],
        children: [
          { name: "Produtos", href: "/catalog/products" },
          { name: "Itens", href: "/catalog/items" },
          { name: "Categorias", href: "/catalog/categories" },
          { name: "Tipos", href: "/catalog/types" },
        ],
      },
    ],
  },
  {
    label: "IA e Automações",
    items: [
      { name: "CestoBot", href: "/ai/bot-flow", icon: BotMessageSquare },
      { name: "LLM Lab", href: "/ai/llm-test", icon: Sparkles },
      { name: "LLM Knowledge", href: "/ai/llm-knowledge", icon: BookOpenText },
      {
        name: "Obsidian Knowledge",
        href: "/ai/obsidian-knowledge",
        icon: BrainCircuit,
      },
      { name: "Prompt Priority", href: "/ai/llm-prompt-priority", icon: SlidersHorizontal },
      { name: "Teste do Bot", href: "/ai/bot-test", icon: TestTube2 },
    ],
  },
  {
    label: "Operação",
    items: [
      { name: "Feriados", href: "/holidays", icon: Calendar },
      { name: "Follow-up", href: "/follow-up", icon: RefreshCw },
      { name: "Estoque", href: "/stock-manager", icon: Warehouse },
      { name: "Cupons", href: "/coupons", icon: Ticket },
      { name: "Pedido Manual", href: "/impressao/manual", icon: Images },
      { name: "Design Editor", href: "/layouts", icon: Palette },
    ],
  },
  {
    label: "Configurações",
    items: [
      { name: "Dispositivos", href: "/settings/devices", icon: Printer },
    ],
  },
];

export function ManagerSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const isItemActive = (item: SidebarItem) => {
    if (pathname === item.href) return true;
    if (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
      return true;
    }
    if (item.children?.some((child) => child.href === pathname)) return true;
    return false;
  };

  const isGroupCollapsed = (label: string) => collapsedGroups[label] ?? false;
  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [label]: !isGroupCollapsed(label),
    }));
  };

  return (
    <SidebarContent>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel
            className="cursor-pointer select-none"
            onClick={() => toggleGroup(group.label)}
          >
            <div className="flex w-full items-center justify-between">
              <span>{group.label}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isGroupCollapsed(group.label) ? "-rotate-90" : "rotate-0"
                }`}
              />
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent
            className={isGroupCollapsed(group.label) ? "hidden" : ""}
          >
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = isItemActive(item);

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link to={item.href}>
                        {item.icon ? <item.icon /> : null}
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.children?.length ? (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.name}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === child.href}
                            >
                              <Link to={child.href}>
                                <span>{child.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}
