import { Handle, Position } from "@xyflow/react";

export default function SearchNode({ data }: { data: any }) {
  const title = String(data?.title || "").trim();
  const searchTerm = data.searchQuery || data.searchPrefix || "*";
  const productIds = Array.isArray(data?.productIds)
    ? data.productIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
    : [];
  const searchMenuTitle =
    String(data?.searchMenuTitle || data?.optionsMenuTitle || "").trim() ||
    "Escolha uma opção:";
  const searchOptionMoreLabel =
    String(data?.searchOptionMoreLabel || "").trim() ||
    "Ver mais opções dessa sessão";
  const searchOptionDoneLabel =
    String(data?.searchOptionDoneLabel || "").trim() ||
    "Já escolhi - Falar com atendente";
  const searchOptionBackLabel =
    String(data?.searchOptionBackLabel || "").trim() || "Voltar ao menu";
  const searchExtraOptions = Array.isArray(data?.searchExtraOptions)
    ? data.searchExtraOptions
        .map((option: unknown) => String(option || "").trim())
        .filter(Boolean)
    : [];
  const delayMs =
    typeof data?.delayMs === "number"
      ? data.delayMs
      : typeof data?.delaySeconds === "number"
        ? Math.round(data.delaySeconds * 1000)
        : 1500;
  const hasExtraFilters =
    Boolean(data.categoryId) ||
    Boolean(data.typeId) ||
    typeof data.minPrice === "number" ||
    typeof data.maxPrice === "number" ||
    Boolean(data.onlyActive) ||
    typeof data.maxResults === "number";

  return (
    <div className="bg-purple-50 border-2 border-purple-500 rounded min-w-[200px] shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500"
      />
      <div className="p-2 bg-purple-500 font-bold border-b text-sm text-white">
        {title || "Busca de Produto"}
      </div>
      {delayMs > 0 && (
        <div className="px-3 pt-2 text-[10px] text-purple-700 bg-white">
          Delay: <span className="font-semibold">{delayMs} ms</span>
        </div>
      )}
      <div className="p-3 text-xs text-purple-900 bg-white">
        Termo chave:{" "}
        <b className="text-purple-700 bg-purple-100 px-1 py-0.5 rounded">
          {searchTerm}
        </b>
        {hasExtraFilters && (
          <div className="mt-2 text-[10px] text-purple-700 space-y-1">
            {data.categoryId && (
              <div>
                Categoria:{" "}
                <span className="font-semibold">
                  {data.categoryLabel || data.categoryId}
                </span>
              </div>
            )}
            {data.typeId && (
              <div>
                Tipo:{" "}
                <span className="font-semibold">
                  {data.typeLabel || data.typeId}
                </span>
              </div>
            )}
            {(typeof data.minPrice === "number" ||
              typeof data.maxPrice === "number") && (
              <div>
                Preço:{" "}
                <span className="font-semibold">
                  {typeof data.minPrice === "number" ? `R$ ${data.minPrice}` : "-"}
                  {" "}até{" "}
                  {typeof data.maxPrice === "number" ? `R$ ${data.maxPrice}` : "-"}
                </span>
              </div>
            )}
            {typeof data.maxResults === "number" && (
              <div>
                Máx. resultados:{" "}
                <span className="font-semibold">{data.maxResults}</span>
              </div>
            )}
            {data.onlyActive && (
              <div>
                Status: <span className="font-semibold">Somente ativos</span>
              </div>
            )}
          </div>
        )}
        {productIds.length > 0 && (
          <div className="mt-2 text-[10px] text-purple-700">
            Produtos fixos: <span className="font-semibold">{productIds.length}</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 bg-white">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data?.onTest?.();
          }}
          className="w-full text-[11px] font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 border border-purple-200 rounded-md py-1 transition-colors"
        >
          {data?.isTesting ? "Testando..." : "Teste"}
        </button>
        {typeof data?.testCount === "number" && (
          <div className="mt-1 text-[10px] text-purple-600">
            {data.testCount === 0
              ? "Sem resultados"
              : `${data.testCount} resultado(s)`}
          </div>
        )}
        <div className="mt-1 text-[10px] text-purple-500">
          Envio: 1 produto por mensagem (1s)
        </div>
      </div>

      <div className="flex flex-col border-t border-purple-200">
        <div className="relative p-2 bg-purple-100/50 text-xs text-left font-semibold text-purple-800 border-b border-purple-200">
          {searchOptionDoneLabel}
          <Handle
            type="source"
            position={Position.Right}
            id="found"
            className="w-3 h-3 bg-purple-600"
            style={{ top: "50%", right: -6 }}
          />
        </div>
        <div className="relative p-2 bg-red-50 text-xs text-left font-semibold text-red-700 border-b border-red-100">
          Se nao encontrar...
          <Handle
            type="source"
            position={Position.Right}
            id="not_found"
            className="w-3 h-3 bg-red-500"
            style={{ top: "50%", right: -6 }}
          />
        </div>
        <div className="relative p-2 bg-amber-50 text-xs text-left font-semibold text-amber-700">
          {searchOptionBackLabel}
          <Handle
            type="source"
            position={Position.Right}
            id="back_to_menu"
            className="w-3 h-3 bg-amber-500"
            style={{ top: "50%", right: -6 }}
          />
        </div>
        {searchExtraOptions.map((option: string, index: number) => (
          <div
            key={`search-extra-option-${index}`}
            className="relative p-2 bg-violet-50 text-xs text-left font-semibold text-violet-700 border-t border-violet-100"
          >
            {option}
            <Handle
              type="source"
              position={Position.Right}
              id={`option-${index}`}
              className="w-3 h-3 bg-violet-500"
              style={{ top: "50%", right: -6 }}
            />
          </div>
        ))}
        <div className="p-2 bg-purple-50 text-[10px] text-purple-600 border-t border-purple-200">
          {searchMenuTitle}
          <br />
          1) {searchOptionMoreLabel}
        </div>
      </div>
    </div>
  );
}
