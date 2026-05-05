import { Link, useLocation } from "react-router-dom";
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
  Lightbulb,
} from "lucide-react";

type Item = {
  name: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  children?: { name: string; href: string }[];
};

type Group = {
  label: string;
  items: Item[];
};

const groups: Group[] = [
  {
    label: "Visao Geral",
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
    label: "IA e Automacoes",
    items: [
      { name: "CestoBot", href: "/bot-flow", icon: BotMessageSquare },
      { name: "LLM Lab", href: "/llm-test", icon: Sparkles },
      { name: "LLM Knowledge", href: "/llm-knowledge", icon: BookOpenText },
      {
        name: "Obsidian Knowledge",
        href: "/obsidian-knowledge",
        icon: BrainCircuit,
      },
      { name: "Teste do Bot", href: "/bot-test", icon: TestTube2 },
    ],
  },
  {
    label: "Operacao",
    items: [
      { name: "Feriados", href: "/holidays", icon: Calendar },
      { name: "Follow-up", href: "/follow-up", icon: RefreshCw },
      { name: "Design Editor", href: "/layouts", icon: Palette },
    ],
  },
];

export function ManagerSidebar() {
  const location = useLocation();

  return (
    <SidebarContent>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  item.children?.some(
                    (child) => child.href === location.pathname,
                  );

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
                              isActive={location.pathname === child.href}
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
