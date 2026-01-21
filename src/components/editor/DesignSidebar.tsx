import { Combine, Type, CloudUpload, Layers, Palette } from "lucide-react";

interface Option {
  label: string;
  icon: any;
  onClick: () => void;
}

interface DesignSidebarProps {
  activePanel: string | null;
  onAddText: () => void;
  onTogglePanel: (panel: string) => void;
}

export const DesignSidebar = ({
  activePanel,
  onAddText,
  onTogglePanel,
}: DesignSidebarProps) => {
  const options = [
    {
      label: "Elementos",
      icon: Combine,
      onClick: () => onTogglePanel("Elementos"),
    },
    { label: "Texto", icon: Type, onClick: () => onTogglePanel("Texto") },
    {
      label: "Uploads",
      icon: CloudUpload,
      onClick: () => onTogglePanel("Uploads"),
    },
    {
      label: "Camadas",
      icon: Layers,
      onClick: () => onTogglePanel("Camadas"),
    },
    {
      label: "Design",
      icon: Palette,
      onClick: () => onTogglePanel("Design"),
    },
  ];

  return (
    <aside className="w-20 py-5 border-r border-gray-800 bg-[#0d1216] shrink-0">
      <nav className="flex flex-col gap-5">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={option.onClick}
            className={`flex flex-col text-xs items-center gap-2 px-1 py-1 transition-colors ${
              activePanel === option.label
                ? "text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <option.icon className="h-5 w-5" />
            {option.label}
          </button>
        ))}
      </nav>
    </aside>
  );
};
