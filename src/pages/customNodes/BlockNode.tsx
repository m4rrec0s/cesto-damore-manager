import { Handle, Position } from "@xyflow/react";

export default function BlockNode({ data }: { data: any }) {
  const title = String(data?.title || "").trim();
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;
  const message = String(data?.message || data?.content || "").trim();

  return (
    <div className="bg-slate-50 border-2 border-slate-500 rounded min-w-[220px] shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-slate-600"
      />
      <div className="p-2 bg-slate-600 text-white font-bold border-b text-sm">
        {title || "Bloqueio (Sem notificação)"}
      </div>
      <div className="p-3">
        {delayMs > 0 && (
          <div className="text-[10px] text-slate-700 font-semibold mb-2 bg-slate-100 rounded px-2 py-1 inline-block">
            Delay: {delayMs} ms
          </div>
        )}
        <div className="text-[10px] text-slate-700 font-semibold mb-2 bg-slate-100 rounded px-2 py-1 inline-block">
          Define sessão como atendimento humano
        </div>
        {message ? (
          <div className="text-xs bg-white text-gray-700 p-2 border border-slate-200 rounded leading-relaxed">
            {message}
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">
            Sem conteúdo para envio.
          </div>
        )}
      </div>
    </div>
  );
}
