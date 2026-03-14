import { Handle, Position } from "@xyflow/react";

export default function HandoffNode({ data }: { data: any }) {
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;

  return (
    <div className="bg-red-50 border-2 border-red-500 rounded min-w-[200px] shadow-sm">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-red-500" />
      <div className="p-2 bg-red-500 text-white font-bold border-b text-sm">
        Atendimento Humano
      </div>
      <div className="p-3">
        {delayMs > 0 && (
          <div className="text-[10px] text-red-700 font-semibold mb-2 bg-red-100 rounded px-2 py-1 inline-block">
            Delay: {delayMs} ms
          </div>
        )}
        <div className="text-[10px] text-red-600 font-semibold mb-2 bg-red-100 rounded px-2 py-1 inline-block">
          PAUSA O BOT (Handoff)
        </div>
        {data.message && (
          <div className="text-xs bg-white text-gray-700 p-2 border border-red-200 rounded leading-relaxed">
            {data.message}
          </div>
        )}
      </div>
    </div>
  );
}
