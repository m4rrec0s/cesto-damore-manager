import { useCallback, useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import type { DynamicLayoutPage } from "@/hooks/usePageManager";

interface PageThumbnailBarProps {
  pages: DynamicLayoutPage[];
  activePageIndex: number;
  isPageSwitching: boolean;
  onSwitchPage: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDuplicate: (index: number) => void;
  onRename: (index: number, newName: string) => void;
}

function SortableThumbnail({
  page,
  index,
  isActive,
  isSwitching,
  isOnlyPage,
  onSwitch,
  onRemove,
  onDuplicate,
  onRename,
}: {
  page: DynamicLayoutPage;
  index: number;
  isActive: boolean;
  isSwitching: boolean;
  isOnlyPage: boolean;
  onSwitch: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onRename: (newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(page.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleRenameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== page.name) {
      onRename(trimmed);
    } else {
      setEditValue(page.name);
    }
    setIsEditing(false);
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col items-center gap-1 p-1 rounded-lg border-2 cursor-pointer transition-colors min-w-[80px] ${
        isActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-400 bg-white"
      }`}
      onClick={onSwitch}
    >
      <div className="relative w-[72px] h-[72px] bg-gray-100 rounded overflow-hidden flex items-center justify-center">
        {isSwitching && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {page.thumbnailDataUrl ? (
          <img
            src={page.thumbnailDataUrl}
            alt={page.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-xs text-gray-400">Sem preview</div>
        )}
        {index === 0 && (
          <span className="absolute top-0.5 left-0.5 text-[10px] bg-amber-400 text-white px-1 rounded">
            Capa
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 w-full">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") {
                setEditValue(page.name);
                setIsEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-gray-600 flex-1 min-w-0 px-0.5 border border-blue-400 rounded outline-none"
          />
        ) : (
          <span
            {...attributes}
            {...listeners}
            className="text-[10px] text-gray-600 truncate flex-1 cursor-grab"
            title="Arrastar para reordenar / Duplo-clique para renomear"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditValue(page.name);
              setIsEditing(true);
            }}
          >
            {page.name}
          </span>
        )}
        {!isOnlyPage && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="text-gray-400 hover:text-blue-500 text-xs leading-none"
              title="Duplicar página"
            >
              ⊕
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-gray-400 hover:text-red-500 text-xs leading-none"
              title="Remover página"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PageThumbnailBar({
  pages,
  activePageIndex,
  isPageSwitching,
  onSwitchPage,
  onAddPage,
  onRemovePage,
  onReorder,
  onDuplicate,
  onRename,
}: PageThumbnailBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = pages.findIndex((p) => p.id === active.id);
      const newIndex = pages.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    },
    [pages, onReorder],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const page = pages[index];
      if (
        page.canvasState &&
        Array.isArray((page.canvasState as any).objects) &&
        (page.canvasState as any).objects.length > 0
      ) {
        if (!confirm(`Remover "${page.name}"? Esta ação não pode ser desfeita.`)) {
          return;
        }
      }
      onRemovePage(index);
    },
    [pages, onRemovePage],
  );

  return (
    <div className="flex items-center gap-2 p-2 bg-neutral-900/80 backdrop-blur-sm border-t border-neutral-700 overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          {pages.map((page, index) => (
            <SortableThumbnail
              key={page.id}
              page={page}
              index={index}
              isActive={index === activePageIndex}
              isSwitching={isPageSwitching && index === activePageIndex}
              isOnlyPage={pages.length === 1}
              onSwitch={() => onSwitchPage(index)}
              onRemove={() => handleRemove(index)}
              onDuplicate={() => onDuplicate(index)}
              onRename={(newName) => onRename(index, newName)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        size="sm"
        onClick={onAddPage}
        className="h-[108px] min-w-[80px] border-dashed flex flex-col items-center gap-1"
      >
        <span className="text-lg">+</span>
        <span className="text-[10px]">Página</span>
      </Button>
    </div>
  );
}
