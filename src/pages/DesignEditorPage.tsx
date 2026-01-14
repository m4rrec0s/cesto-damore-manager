import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/useAuth";
import {
  CloudCheck,
  CloudSync,
  CloudUpload,
  Combine,
  CornerUpLeft,
  CornerUpRight,
  Menu,
  Pen,
  Type,
  Upload,
} from "lucide-react";
import { useState } from "react";

interface DesignEditorPageProps {
  params: {
    id: string;
  };
}

const SeparatorVertical = () => (
  <span className="h-8 w-0.5 bg-white/30 z-10 rounded mx-2"></span>
);

const DesignEditorPage = ({ params }: DesignEditorPageProps) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const id = params.id;

  const options = [
    { label: "Elementos", icon: Combine },
    { label: "Texto", icon: Type },
    { label: "Uploads", icon: CloudUpload },
  ];

  return (
    <section className="text-white h-screen flex flex-col">
      <header className="flex items-center justify-between h-12 px-6 border-b border-neutral-700 bg-linear-to-r from-teal-500 via-blue-500 to-purple-500">
        <div className="flex items-center w-full">
          <div className="flex items-center gap-3 h-fit">
            <Button
              variant="link"
              className="px-0 py-0 text-white hover:no-underline hover:cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </Button>

            <h1 className="text-sm font-bold">Design Editor</h1>
            <Button
              variant="link"
              className="px-0 py-0 text-white hover:no-underline hover:cursor-pointer"
            >
              <Pen className="h-4 w-4" />
              Redimensionar
            </Button>
          </div>

          <SeparatorVertical />

          <div className="flex items-center gap-1">
            <Button
              variant="link"
              className="px-0 py-0 p-0 text-white hover:no-underline hover:cursor-pointer"
            >
              <CornerUpLeft className="h-4 w-4" />
            </Button>
            <Button
              disabled
              variant="link"
              className="px-0 py-0 p-0 text-white hover:no-underline hover:cursor-pointer"
            >
              <CornerUpRight className="h-4 w-4" />
            </Button>
          </div>

          <SeparatorVertical />

          <div className="px-2">
            {loading ? (
              <CloudSync className="h-4 w-4 animate-pulse" />
            ) : (
              <CloudCheck className="h-6 w-6" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end w-full gap-3">
          <Input
            type="text"
            value={"Modelo Caneca Romântica 001 - 20 x 9,4 cm"}
            className="font-semibold max-w-sm"
          />

          <Avatar>
            <AvatarImage src={user?.image_url || ""} />
            <AvatarFallback className="text-black">
              {user?.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <Button variant="secondary">
            <span className="px-6 flex items-center gap-2 font-semibold">
              <Upload className="h-4 w-4" />
              Salvar Design
            </span>
          </Button>
        </div>
      </header>
      <main className="flex-1 flex items-center">
        <aside className="w-20 py-5 h-full">
          <nav className="flex flex-col gap-5">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.label}
                  className="flex flex-col text-neutral-400 text-xs items-center gap-2 px-1 py-1 rounded hover:bg-white/10"
                >
                  <Icon className="h-5 w-5" />
                  {option.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white w-7xl h-160 overflow-hidden"></div>
        </div>
      </main>
    </section>
  );
};

export default DesignEditorPage;
