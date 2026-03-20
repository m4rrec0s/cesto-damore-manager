import { Handle, Position } from "@xyflow/react";

export default function MessageNode({ data }: { data: any }) {
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;
  const title = String(data?.title || "").trim();
  const content = String(data?.message || "").trim();

  return (
    <div className="bg-white border-2 border-gray-400 rounded min-w-[200px] shadow-sm">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-500" />
      <div className="p-2 bg-gray-100 font-bold border-b text-sm text-gray-700">
        {title || "Mensagem Simples"}
      </div>
      {delayMs > 0 && (
        <div className="px-3 pt-2 text-[10px] text-gray-600">
          Delay: <span className="font-semibold">{delayMs} ms</span>
        </div>
      )}
      <div className="p-3 text-xs text-gray-600 whitespace-pre-wrap max-w-[250px] leading-relaxed">
        {content || "Clique para editar a mensagem..."}
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-500" />
    </div>
  );
}
