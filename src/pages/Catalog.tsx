import { useState } from "react";
import { Package, Box, Tag } from "lucide-react";
import { ProductsTab } from "../components/catalog/ProductsTab";
import { ItemsTab } from "../components/catalog/ItemsTab";
import { CategoriesTab } from "../components/catalog/CategoriesTab";
import { TypesTab } from "../components/catalog/TypesTab";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

type TabType = "products" | "items" | "categories" | "types";

export function Catalog() {
  const [activeTab, setActiveTab] = useState<TabType>("products");

  const tabs = [
    { id: "products", name: "Produtos", icon: Package },
    { id: "items", name: "Itens (Componentes)", icon: Box },
    { id: "categories", name: "Categorias", icon: Tag },
    { id: "types", name: "Tipos", icon: Tag },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-950">Catálogo</h2>
          <p className="text-neutral-600/70 font-medium">
            Gerencie seus produtos, itens individuais e categorias.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1.5 bg-neutral-100/50 backdrop-blur-sm rounded-2xl w-fit border border-neutral-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
              activeTab === tab.id
                ? "bg-white text-neutral-600 shadow-md"
                : "text-neutral-900/60 hover:text-neutral-900"
            )}
          >
            <tab.icon size={18} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence mode="wait">
          {activeTab === "products" && <ProductsTab key="products" />}
          {activeTab === "items" && <ItemsTab key="items" />}
          {activeTab === "categories" && <CategoriesTab key="categories" />}
          {activeTab === "types" && <TypesTab key="types" />}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
