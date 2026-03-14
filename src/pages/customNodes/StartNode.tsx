import { Handle, Position } from "@xyflow/react";

export default function StartNode({ data }: { data?: any }) {
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;

  return (
    <div className="bg-green-50 border-2 border-green-600 rounded p-3 text-center text-sm font-bold shadow-md min-w-[150px]">
      <div className="text-green-800">START (Obrigatório)</div>
      {delayMs > 0 && (
        <div className="text-[10px] text-green-700 font-semibold mt-1">
          Delay: {delayMs} ms
        </div>
      )}
      <div className="text-[10px] text-green-600 font-normal mt-1 leading-tight">
        A conversa sempre começa por aqui.
      </div>
      <Handle type="source" position={Position.Right} id="a" className="w-3 h-3 bg-green-600" />
    </div>
  );
}
