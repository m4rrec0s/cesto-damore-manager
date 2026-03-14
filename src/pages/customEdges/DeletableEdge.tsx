import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { Trash2 } from "lucide-react";

export default function DeletableEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
}: any) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 1000,
            }}
          >
            <button
              type="button"
              className="flex items-center justify-center h-6 w-6 rounded-full border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50"
              onClick={(event) => {
                event.stopPropagation();
                data?.onDelete?.(id);
              }}
              title="Remover conexão"
              aria-label="Remover conexão"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
