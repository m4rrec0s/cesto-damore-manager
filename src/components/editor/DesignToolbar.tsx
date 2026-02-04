import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Menu,
  Pen,
  CornerUpLeft,
  CornerUpRight,
  CloudSync,
  CloudCheck,
  Upload,
  Download,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useUI } from "../../contexts/UIContext";

interface DesignToolbarProps {
  designId?: string | null;
  designName: string;
  setDesignName: (name: string) => void;
  onResize: (w: number, h: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExportHighQuality?: () => void;
  saving: boolean;
  loading: boolean;
  user: any;
  isDirty?: boolean;
  productionTime: number;
  setProductionTime: (time: number) => void;
}

const SeparatorVertical = () => (
  <span className="h-8 w-0.5 bg-white/30 z-10 rounded mx-2"></span>
);

export const DesignToolbar = ({
  designId,
  designName,
  setDesignName,
  onResize,
  onUndo,
  onRedo,
  onSave,
  onExportHighQuality,
  saving,
  loading,
  user,
  isDirty,
  productionTime,
  setProductionTime,
}: DesignToolbarProps) => {
  const { toggleSidebar } = useUI();

  return (
    <header className="flex items-center justify-between h-12 px-6 border-b border-neutral-700 bg-linear-to-r from-teal-500 via-blue-500 to-purple-500 shrink-0">
      <div className="flex items-center w-full">
        <div className="flex items-center gap-3 h-fit">
          <Button
            variant="link"
            className="px-0 py-0 text-white hover:no-underline"
            onClick={toggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-bold">Arquivo</h1>
          <SeparatorVertical />
          {/* <Button variant="link" onClick={() => onResize(20, 9.4)} className="text-white text-xs gap-1">
                        <Pen className="h-3 w-3" /> Caneca
                    </Button>
                    <Button variant="link" onClick={() => onResize(10, 15)} className="text-white text-xs gap-1">
                        <Pen className="h-3 w-3" /> Quadro
                    </Button> */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex gap-1 text-white text-sm font-semibold items-center mx-4">
              {" "}
              <Pen className="h-3 w-3" /> Redimensionar
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onResize(20, 9.4)}>
                <svg
                  className="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    d="M5 5c-.28252 0-.55187.11951-.74145.32899-.18958.20949-.2817.48939-.25358.77051l.6398 6.398C4.90037 15.0535 7.0512 17 9.61995 17h.76015c2.3975 0 4.431-1.6957 4.8992-4H17c1.6569 0 3-1.3431 3-3 0-1.65685-1.3431-3-3-3h-1.095l.09-.9005c.0282-.28112-.064-.56102-.2535-.77051C15.5519 5.11951 15.2825 5 15 5H5Zm12 6h-1.495l.2-2H17c.5523 0 1 .44772 1 1 0 .5523-.4477 1-1 1Z"
                    clipRule="evenodd"
                  />
                  <path
                    fill="currentColor"
                    d="M5 18c-.55228 0-1 .4477-1 1s.44772 1 1 1h11c.5523 0 1-.4477 1-1s-.4477-1-1-1H5Z"
                  />
                </svg>
                Caneca
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onResize(10, 15)}>
                <svg
                  className="w-6 h-6 text-gray-800 dark:text-white"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m3 16 5-7 6 6.5m6.5 2.5L16 13l-4.286 6M14 10h.01M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"
                  />
                </svg>
                Quadro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <SeparatorVertical />
        <div className="flex items-center gap-1">
          <Button variant="link" onClick={onUndo} className="p-0 text-white">
            <CornerUpLeft className="h-4 w-4" />
          </Button>
          <Button variant="link" onClick={onRedo} className="p-0 text-white">
            <CornerUpRight className="h-4 w-4" />
          </Button>
        </div>
        <SeparatorVertical />
        <div className="px-2">
          {saving || loading ? (
            <CloudSync className="h-4 w-4 animate-pulse" />
          ) : isDirty ? (
            <div
              className="flex items-center gap-1.5 opacity-80"
              title="Alterações pendentes"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span className="text-[10px] font-medium uppercase tracking-wider">
                Pendente
              </span>
            </div>
          ) : (
            <CloudCheck className="h-6 w-6 text-green-300" />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end w-full gap-3">
        <Link to={"/design-test/" + designId} title="Ir para teste">
          <Eye className="h-6 w-6" />
        </Link>
        <Input
          value={designName}
          onChange={(e) => setDesignName(e.target.value)}
          className="font-semibold max-w-[200px] h-8 bg-black/20 border-white/10"
          placeholder="Nome do design"
        />
        <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-md px-2 h-8">
          <span className="text-[10px] uppercase font-bold text-white/60 whitespace-nowrap">Tempo (h)</span>
          <Input
            type="number"
            value={productionTime}
            onChange={(e) => setProductionTime(parseInt(e.target.value) || 0)}
            className="w-16 h-6 bg-transparent border-none text-center p-0 font-bold focus-visible:ring-0"
            min={0}
          />
        </div>
        <Avatar className="h-8 w-8 border border-green-500">
          <AvatarImage src={user?.image_url || ""} />
          <AvatarFallback className="text-black text-xs">
            {user?.name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        {onExportHighQuality && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportHighQuality}
            title="Exportar em alta qualidade (4x resolução)"
            className="bg-transparent hover:bg-white/50"
          >
            <Download className="h-6 w-6" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <Upload className="h-4 w-4 mr-2" /> Publicar
        </Button>
      </div>
    </header>
  );
};
