import { Handle, Position } from "@xyflow/react";

export default function FollowUpNode({ data }: { data: any }) {
  const options = Array.isArray(data?.options) ? data.options : [];
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;
  const totalMinutes =
    typeof data?.inactivityMinutes === "number" && data.inactivityMinutes > 0
      ? Math.round(data.inactivityMinutes)
      : typeof data?.inactivityHours === "number" && data.inactivityHours > 0
        ? Math.round(data.inactivityHours * 60)
        : 24 * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const inactivityLabel =
    hours > 0 && minutes > 0
      ? `${hours}h ${minutes}min`
      : hours > 0
        ? `${hours}h`
        : `${minutes}min`;
  const title = (data?.title || data?.message || "Follow-up automático").trim();

  return (
    <div className="bg-amber-50 border-2 border-amber-500 rounded-xl min-w-[250px] shadow-sm overflow-hidden">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <div className="p-2.5 bg-amber-500 text-white font-bold flex items-center gap-2 text-sm shadow-sm">
        <span>Follow Up</span>
      </div>
      <div className="px-3 pt-2 text-[10px] text-amber-700 bg-white space-y-1">
        {delayMs > 0 && (
          <div>
            Delay: <span className="font-semibold">{delayMs} ms</span>
          </div>
        )}
        <div>
          Disparo após: <span className="font-semibold">{inactivityLabel}</span>{" "}
          sem mensagem
        </div>
      </div>
      <div className="p-3 text-xs text-amber-900 border-b border-amber-100 bg-white">
        {title}
      </div>

      <div className="flex flex-col gap-2 p-3 bg-amber-50/50">
        {options.length > 0 ? (
          options.map((opt: any, index: number) => {
            const label =
              typeof opt === "string"
                ? opt
                : (opt?.label ?? `Opção ${index + 1}`);
            return (
              <div
                key={index}
                className="relative bg-white border border-amber-200 p-2 rounded-lg text-xs shadow-sm flex items-center group hover:bg-amber-50 transition-colors"
              >
                <span className="font-semibold text-gray-700 w-full truncate pr-4">
                  {label}
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={String(index)}
                  className="w-3.5 h-3.5 bg-amber-500 border-2 border-white"
                  style={{ top: "50%", right: -6 }}
                />
              </div>
            );
          })
        ) : (
          <div className="text-xs text-gray-400 italic text-center py-2 bg-white/50 rounded-lg border border-dashed border-gray-300">
            Sem opções. A mensagem configurada será enviada.
          </div>
        )}
      </div>
    </div>
  );
}
