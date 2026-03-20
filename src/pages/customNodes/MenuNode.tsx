import { Handle, Position } from "@xyflow/react";

export default function MenuNode({ data, id }: { data: any, id: string }) {
  // Defensive check for old data structures
  const options = Array.isArray(data.options) ? data.options : [];
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;
  const menuHeader = String(data?.menu_title || data?.message || "Selecione uma opção:").trim();

  return (
    <div className="bg-blue-50 border-2 border-blue-500 rounded-xl min-w-[250px] shadow-sm overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-2 border-white" />
      <div className="p-2.5 bg-blue-500 text-white font-bold flex items-center gap-2 text-sm shadow-sm">
        <span>Menu</span>
      </div>
      {delayMs > 0 && (
        <div className="px-3 pt-2 text-[10px] text-blue-700 bg-white">
          Delay: <span className="font-semibold">{delayMs} ms</span>
        </div>
      )}
      <div className="p-3 text-xs text-blue-900 border-b border-blue-100 bg-white">
        {menuHeader}
      </div>
      
      <div className="flex flex-col gap-2 p-3 bg-blue-50/50">
        {options.map((opt: any, index: number) => {
           const label = typeof opt === 'string' ? opt : (opt.label || `Opção ${index + 1}`);
           return (
            <div key={index} className="relative bg-white border border-blue-200 p-2 rounded-lg text-xs shadow-sm flex items-center group hover:bg-blue-50 transition-colors">
              <span className="font-semibold text-gray-700 w-full truncate pr-4">{label}</span>
              <Handle 
                type="source" 
                position={Position.Right} 
                id={String(index)} 
                className="w-3.5 h-3.5 bg-blue-500 border-2 border-white"
                style={{ top: '50%', right: -6 }}
              />
            </div>
          );
        })}
        {options.length === 0 && (
          <div className="text-xs text-gray-400 italic text-center py-2 bg-white/50 rounded-lg border border-dashed border-gray-300">
            Nenhuma opção
          </div>
        )}
      </div>
    </div>
  );
}
