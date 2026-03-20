import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Node, Edge, Connection, ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useApi } from "../services/api";
import type { Category, Type, Product } from "../services/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import {
  Plus,
  Trash,
  PlusCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";
import StartNode from "./customNodes/StartNode";
import MessageNode from "./customNodes/MessageNode";
import MenuNode from "./customNodes/MenuNode";
import SearchNode from "./customNodes/SearchNode";
import HandoffNode from "./customNodes/HandoffNode";
import FollowUpNode from "./customNodes/FollowUpNode";
import BlockNode from "./customNodes/BlockNode";
import DeletableEdge from "./customEdges/DeletableEdge";

const nodeTypes = {
  startNode: StartNode,
  messageNode: MessageNode,
  menuNode: MenuNode,
  productSearchNode: SearchNode,
  handoffNode: HandoffNode,
  followUpNode: FollowUpNode,
  blockNode: BlockNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

export default function BotFlowPage() {
  const api = useApi();
  type BotNodeData = Record<string, any>;
  type BotEdgeData = { onDelete?: (edgeId: string) => void };
  type BotEdge = Edge<BotEdgeData>;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BotNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BotEdge>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance<
    Node<BotNodeData>,
    any
  > | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<Type[]>([]);
  const [searchTestState, setSearchTestState] = useState<
    Record<
      string,
      {
        loading: boolean;
        results: Product[];
        allResults: Product[];
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
        error?: string;
      }
    >
  >({});
  const [isNodePanelOpen, setIsNodePanelOpen] = useState(true);
  const [initialSnapshot, setInitialSnapshot] = useState<string>(
    JSON.stringify({ nodes: [], edges: [] }),
  );

  // Use explicit state for node selection instead of relying completely on React Flow's selected property
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const resolveFollowUpInactivityMinutes = (nodeData: Record<string, any>) => {
    if (
      typeof nodeData?.inactivityMinutes === "number" &&
      Number.isFinite(nodeData.inactivityMinutes)
    ) {
      return Math.max(1, Math.round(nodeData.inactivityMinutes));
    }

    if (
      typeof nodeData?.inactivityHours === "number" &&
      Number.isFinite(nodeData.inactivityHours)
    ) {
      return Math.max(1, Math.round(nodeData.inactivityHours * 60));
    }

    return 24 * 60;
  };

  const parseListInput = (value: string) =>
    value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

  const parseCommaListInput = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const listToMultiline = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item || "")).join("\n") : "";

  const listToComma = (value: unknown) =>
    Array.isArray(value) ? value.map((item) => String(item || "")).join(", ") : "";

  useEffect(() => {
    fetchFlow();
  }, []);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [cats, tps] = await Promise.all([
          api.getCategories(),
          api.getTypes(),
        ]);
        setCategories(cats || []);
        setTypes(tps || []);
      } catch (e) {
        toast.error("Erro ao carregar filtros de produtos");
      }
    };
    loadFilters();
  }, [api]);

  const fetchFlow = async () => {
    try {
      setLoading(true);
      const res = await api.get("/bot/flow");
      if (res.data) {
        const normalizedNodes = (res.data.nodes || []).map((node: Node) => ({
          ...node,
          data: {
            delayMs: 1500,
            ...(node.data || {}),
            menu_title:
              node.type === "menuNode"
                ? (node.data as Record<string, any>)?.menu_title ||
                  (node.data as Record<string, any>)?.message ||
                  ""
                : (node.data as Record<string, any>)?.menu_title,
          },
        }));
        setNodes(normalizedNodes);
        setEdges(res.data.edges || []);
        setInitialSnapshot(
          JSON.stringify({
            nodes: normalizedNodes,
            edges: res.data.edges || [],
          }),
        );
      }
    } catch (e) {
      toast.error("Erro ao carregar fluxo");
    } finally {
      setLoading(false);
    }
  };

  const validateFlow = () => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const followUpHoursSeen = new Set<number>();

    for (const edge of edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
        return "Fluxo inválido: existe conexão apontando para nó inexistente.";
      }
    }

    for (const node of nodes) {
      const outEdges = edges.filter((edge) => edge.source === node.id);

      if (node.type === "menuNode" || node.type === "followUpNode") {
        const options = Array.isArray(node.data?.options)
          ? node.data.options
          : [];
        if (options.length === 0) {
          return "Menu sem opções configuradas.";
        }

        for (let index = 0; index < options.length; index++) {
          const matches = outEdges.filter((edge) => {
            const handle = String(edge.sourceHandle ?? "");
            return handle === String(index) || handle === `option-${index}`;
          });
          if (matches.length === 0) {
            return `Menu com opção ${index + 1} sem conexão de saída.`;
          }
          if (matches.length > 1) {
            return `Menu com opção ${index + 1} apontando para múltiplos destinos.`;
          }
        }

        if (node.type === "followUpNode") {
          const configuredMinutes = resolveFollowUpInactivityMinutes(
            (node.data || {}) as Record<string, any>,
          );
          if (!Number.isFinite(configuredMinutes) || configuredMinutes <= 0) {
            return "Follow Up precisa de tempo de inatividade maior que 0 minuto.";
          }

          if (followUpHoursSeen.has(Math.round(configuredMinutes))) {
            return "Não é permitido ter dois nós Follow Up com o mesmo tempo configurado.";
          }
          followUpHoursSeen.add(Math.round(configuredMinutes));
        }
      }

      if (node.type === "productSearchNode") {
        const found = outEdges.filter(
          (edge) => String(edge.sourceHandle ?? "") === "found",
        );
        const notFound = outEdges.filter(
          (edge) => String(edge.sourceHandle ?? "") === "not_found",
        );
        const backToMenu = outEdges.filter(
          (edge) => String(edge.sourceHandle ?? "") === "back_to_menu",
        );

        if (found.length !== 1) {
          return "Busca precisa de exatamente uma saída em 'Se encontrar produtos'.";
        }
        if (notFound.length !== 1) {
          return "Busca precisa de exatamente uma saída em 'Se nao encontrar'.";
        }
        if (backToMenu.length !== 1) {
          return "Busca precisa de exatamente uma saída em 'Voltar ao menu'.";
        }

        if (notFound[0].target === backToMenu[0].target) {
          return "As saídas 'Se nao encontrar' e 'Voltar ao menu' da busca devem apontar para nós diferentes.";
        }
      }
    }

    return null;
  };

  const saveFlow = async () => {
    const validationError = validateFlow();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setIsSaving(true);
      await api.post("/bot/flow", { nodes, edges });
      setInitialSnapshot(JSON.stringify({ nodes, edges }));
    } catch (e) {
      toast.error("Erro ao salvar fluxo");
    } finally {
      setIsSaving(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) {
        toast.error("Conexão inválida.");
        return;
      }

      const sourceNode = nodes.find((node) => node.id === params.source);
      const sourceHandle =
        params.sourceHandle === null || params.sourceHandle === undefined
          ? null
          : String(params.sourceHandle);
      const requiresHandle =
        sourceNode?.type === "menuNode" ||
        sourceNode?.type === "productSearchNode" ||
        sourceNode?.type === "followUpNode";

      if (requiresHandle && !sourceHandle) {
        toast.error("Use um conector de saída válido deste bloco.");
        return;
      }

      const hasReservedHandle =
        sourceHandle === "found" ||
        sourceHandle === "not_found" ||
        sourceHandle === "back_to_menu" ||
        /^\d+$/.test(sourceHandle ?? "") ||
        /^option-\d+$/.test(sourceHandle ?? "");

      if (sourceNode && sourceHandle && hasReservedHandle) {
        const alreadyConnected = edges.some(
          (edge) =>
            edge.source === params.source &&
            String(edge.sourceHandle ?? "") === sourceHandle,
        );
        if (alreadyConnected) {
          toast.error("Este conector já possui uma saída configurada.");
          return;
        }
      }

      setEdges((eds) => addEdge(params, eds));
    },
    [edges, nodes, setEdges],
  );

  const addNode = (type: string) => {
    const baseData = {
      delayMs: 1500,
    };
    let position = { x: 250, y: 150 };
    if (reactFlowWrapper.current && reactFlowInstance.current) {
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const center = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
      position = reactFlowInstance.current.screenToFlowPosition(center);
    }
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
        data: {
          ...baseData,
          message:
            type === "handoffNode"
              ? "Transferindo para atendente..."
              : type === "followUpNode"
                ? "Percebemos que você ficou ausente. Posso te ajudar com algo?"
                : type === "blockNode"
                  ? ""
                  : "Nova mensagem",
          menu_title: type === "menuNode" ? "Escolha uma opção:" : undefined,
          title:
            type === "followUpNode"
              ? "Follow-up de inatividade"
              : type === "startNode"
                ? "Início do atendimento"
                : type === "menuNode"
                  ? "Menu de opções"
                  : type === "handoffNode"
                    ? "Transferência para humano"
                    : type === "blockNode"
                      ? "Encerramento silencioso"
                      : type === "productSearchNode"
                        ? "Busca de produtos"
                        : "Mensagem",
        inactivityMinutes: type === "followUpNode" ? 24 * 60 : undefined,
        options:
          type === "menuNode" || type === "followUpNode" ? [] : undefined,
        searchQuery: "",
        categoryId: "",
        typeId: "",
        minPrice: undefined,
        maxPrice: undefined,
        onlyActive: false,
        maxResults: 6,
        page: 1,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      }),
    );
  };

  const SEARCH_TEST_PER_PAGE = 6;

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
    },
    [setEdges],
  );

  const runSearchTest = useCallback(
    async (nodeId: string, pageOverride?: number) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const data = (node.data || {}) as BotNodeData;

      setSearchTestState((prev) => ({
        ...prev,
        [nodeId]: {
          loading: true,
          results: prev[nodeId]?.results || [],
          allResults: prev[nodeId]?.allResults || [],
          page: prev[nodeId]?.page || 1,
          perPage: prev[nodeId]?.perPage || SEARCH_TEST_PER_PAGE,
          total: prev[nodeId]?.total || 0,
          totalPages: prev[nodeId]?.totalPages || 0,
        },
      }));

      try {
        const response = await api.getProducts({
          page: 1,
          perPage: 1000,
          search: data.searchQuery || data.searchPrefix || undefined,
          category_id: data.categoryId || undefined,
          type_id: data.typeId || undefined,
        });

        let results = response.products || [];
        if (typeof data.minPrice === "number") {
          results = results.filter((p) => (p.price ?? 0) >= data.minPrice);
        }
        if (typeof data.maxPrice === "number") {
          results = results.filter((p) => (p.price ?? 0) <= data.maxPrice);
        }
        if (data.onlyActive) {
          results = results.filter((p) => p.is_active !== false);
        }
        if (typeof data.maxResults === "number") {
          results = results.slice(0, data.maxResults);
        }

        const total = results.length;
        const totalPages = Math.max(1, Math.ceil(total / SEARCH_TEST_PER_PAGE));
        const requestedPage =
          typeof pageOverride === "number" ? pageOverride : data.page || 1;
        const safePage = Math.min(Math.max(requestedPage, 1), totalPages);
        const pageStart = (safePage - 1) * SEARCH_TEST_PER_PAGE;
        const pageResults = results.slice(
          pageStart,
          pageStart + SEARCH_TEST_PER_PAGE,
        );

        setSearchTestState((prev) => ({
          ...prev,
          [nodeId]: {
            loading: false,
            results: pageResults,
            allResults: results,
            page: safePage,
            perPage: SEARCH_TEST_PER_PAGE,
            total,
            totalPages,
          },
        }));
      } catch (e) {
        setSearchTestState((prev) => ({
          ...prev,
          [nodeId]: {
            loading: false,
            results: [],
            allResults: [],
            page: 1,
            perPage: SEARCH_TEST_PER_PAGE,
            total: 0,
            totalPages: 0,
            error: "Erro ao testar busca",
          },
        }));
      }
    },
    [api, nodes],
  );

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const typeMap = useMemo(() => {
    return new Map(types.map((t) => [t.id, t.name]));
  }, [types]);

  const nodesForRender = useMemo(() => {
    return nodes.map((node) => {
      if (node.type !== "productSearchNode") return node;
      const testInfo = searchTestState[node.id];
      const data = (node.data || {}) as BotNodeData;
      const categoryLabel = data.categoryId
        ? categoryMap.get(data.categoryId)
        : undefined;
      const typeLabel = data.typeId ? typeMap.get(data.typeId) : undefined;
      return {
        ...node,
        data: {
          ...data,
          onTest: () => runSearchTest(node.id),
          isTesting: testInfo?.loading,
          testCount:
            typeof testInfo?.total === "number"
              ? testInfo.total
              : testInfo?.results?.length,
          categoryLabel,
          typeLabel,
        },
      };
    });
  }, [nodes, searchTestState, categoryMap, typeMap, runSearchTest]);

  const edgesForRender = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: "deletable",
        selectable: true,
        interactionWidth: 20,
        data: { ...(edge.data || {}), onDelete: handleDeleteEdge },
      })),
    [edges, handleDeleteEdge],
  );

  const nodeTypeLabel = (nodeType?: string | null) => {
    switch (nodeType) {
      case "startNode":
        return "Start";
      case "messageNode":
        return "Mensagem";
      case "menuNode":
        return "Menu";
      case "productSearchNode":
        return "Busca";
      case "handoffNode":
        return "Atendente";
      case "followUpNode":
        return "Follow Up";
      case "blockNode":
        return "Bloqueio";
      default:
        return "Nó";
    }
  };

  const nodePreview = (node: Node) => {
    const data = (node.data || {}) as BotNodeData;
    const title = String(data?.title || "").trim();
    if (title) return title;
    if (node.type === "menuNode") {
      const options = Array.isArray(data.options) ? data.options : [];
      return options.length > 0 ? `Opções: ${options.length}` : "Sem opções";
    }
    if (node.type === "followUpNode") {
      const options = Array.isArray(data.options) ? data.options : [];
      const totalMinutes = resolveFollowUpInactivityMinutes(data);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const timeLabel =
        hours > 0 && minutes > 0
          ? `${hours}h ${minutes}min`
          : hours > 0
            ? `${hours}h`
            : `${minutes}min`;
      return `${timeLabel} • ${options.length} opção(ões)`;
    }
    if (node.type === "productSearchNode") {
      const searchTerm = data.searchQuery || data.searchPrefix;
      return searchTerm ? `Busca: ${searchTerm}` : "Busca: *";
    }
    if (data?.message) return String(data.message).slice(0, 60);
    return "Sem detalhes";
  };

  const formatTestProductPreview = (product: any) => {
    const stripHtml = (value?: string | null) =>
      (value || "").replace(/<[^>]*>/g, "").trim();
    const formattedPrice =
      typeof product?.price === "number"
        ? product.price.toFixed(2).replace(".", ",")
        : "0,00";
    const productionTime =
      typeof product?.production_time === "number" &&
      product.production_time > 0
        ? product.production_time
        : 2;

    const parts = [
      product?.image_url || product?.imageUrl || null,
      `*${product?.name || "Produto"}* - VALOR - R$ ${formattedPrice}`,
      stripHtml(product?.description) || null,
      `(Tempo de produção: ${productionTime} horas em horário comercial)`,
    ].filter(Boolean);

    return parts.join("\n");
  };

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const onPaneClick = () => {
    setSelectedNodeId(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const selectedSearchTest =
    selectedNode?.type === "productSearchNode"
      ? searchTestState[selectedNode.id]
      : null;

  const changeSearchTestPage = (page: number) => {
    if (!selectedNode || selectedNode.type !== "productSearchNode") return;
    const current = searchTestState[selectedNode.id];
    if (!current || current.loading) return;
    const safePage = Math.min(Math.max(page, 1), current.totalPages || 1);
    const pageStart = (safePage - 1) * current.perPage;
    const pageResults = current.allResults.slice(
      pageStart,
      pageStart + current.perPage,
    );
    setSearchTestState((prev) => ({
      ...prev,
      [selectedNode.id]: {
        ...current,
        page: safePage,
        results: pageResults,
      },
    }));
    updateNodeData(selectedNode.id, { page: safePage });
  };
  const isDirty = JSON.stringify({ nodes, edges }) !== (initialSnapshot || "");

  const addMenuOption = () => {
    if (
      !selectedNode ||
      (selectedNode.type !== "menuNode" &&
        selectedNode.type !== "followUpNode")
    )
      return;
    const currentOptions = Array.isArray(selectedNode.data.options)
      ? selectedNode.data.options
      : [];
    updateNodeData(selectedNode.id, {
      options: [...currentOptions, "Nova Opção"],
    });
  };

  const updateMenuOption = (index: number, value: string) => {
    if (
      !selectedNode ||
      (selectedNode.type !== "menuNode" &&
        selectedNode.type !== "followUpNode")
    )
      return;
    const currentOptions = Array.isArray(selectedNode.data.options)
      ? [...selectedNode.data.options]
      : [];
    currentOptions[index] = value;
    updateNodeData(selectedNode.id, { options: currentOptions });
  };

  const removeMenuOption = (index: number) => {
    if (
      !selectedNode ||
      (selectedNode.type !== "menuNode" &&
        selectedNode.type !== "followUpNode")
    )
      return;
    const currentOptions = Array.isArray(selectedNode.data.options)
      ? [...selectedNode.data.options]
      : [];
    currentOptions.splice(index, 1);
    updateNodeData(selectedNode.id, { options: currentOptions });
  };

  const removeSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id,
      ),
    );
    setSelectedNodeId(null);
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] space-y-4 p-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">
          Fluxo do Bot (Anna)
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={saveFlow}
            className="shadow bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSaving || !isDirty}
          >
            {isSaving ? "Salvando..." : "Salvar Fluxo"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 flex-col lg:flex-row">
        {/* Lista de Nodes */}
        <div
          className={`bg-white border-2 border-gray-200 rounded-xl flex flex-col shadow-lg shrink-0 min-h-[240px] max-h-[320px] lg:max-h-none transition-all duration-300 ${
            isNodePanelOpen ? "w-full lg:w-72" : "w-full lg:w-14"
          }`}
        >
          <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
            {isNodePanelOpen && (
              <div className="flex flex-col">
                <h3 className="font-bold text-gray-800 text-sm">
                  Lista de Nós
                </h3>
                <span className="text-[10px] text-gray-500">
                  {nodes.length} total
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsNodePanelOpen((prev) => !prev)}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50"
              aria-label={isNodePanelOpen ? "Recolher painel" : "Abrir painel"}
            >
              {isNodePanelOpen ? (
                <ChevronLeft size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>

          {isNodePanelOpen && (
            <>
              <div className="p-3 border-b border-gray-100 space-y-2">
                <Button
                  onClick={() => addNode("startNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                >
                  <Plus size={14} />
                  Start
                </Button>
                <Button
                  onClick={() => addNode("messageNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Plus size={14} />
                  Mensagem
                </Button>
                <Button
                  onClick={() => addNode("menuNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  <Plus size={14} />
                  Menu
                </Button>
                <Button
                  onClick={() => addNode("productSearchNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                >
                  <Plus size={14} />
                  Busca
                </Button>
                <Button
                  onClick={() => addNode("handoffNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                >
                  <Plus size={14} />
                  Atendente
                </Button>
                <Button
                  onClick={() => addNode("followUpNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                >
                  <Plus size={14} />
                  Follow Up
                </Button>
                <Button
                  onClick={() => addNode("blockNode")}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100"
                >
                  <Lock size={14} />
                  Bloqueio
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {nodes.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-6">
                    Nenhum nó criado.
                  </div>
                ) : (
                  nodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selectedNodeId === node.id
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          {nodeTypeLabel(node.type)}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate max-w-[90px]">
                          {node.id.split("-")[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {nodePreview(node)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Editor de Grafos */}
        <div
          className="flex-1 border-2 border-gray-200 rounded-xl overflow-hidden shadow-inner bg-gray-50 h-[400px] lg:h-auto"
          ref={reactFlowWrapper}
        >
          <ReactFlow
            nodes={nodesForRender}
            edges={edgesForRender}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            onInit={(instance) => {
              reactFlowInstance.current = instance;
            }}
          >
            <Background gap={16} size={1.5} color="#e2e8f0" />
            <Controls className="bg-white shadow-md border border-gray-100 rounded-lg p-1 m-2" />
          </ReactFlow>
        </div>

        {/* Barra Lateral Editavel */}
        <div className="w-full lg:w-80 bg-white border-2 border-gray-200 rounded-xl flex flex-col overflow-y-auto shadow-lg shrink-0 h-auto min-h-[300px]">
          {selectedNode ? (
            <div className="p-5 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex justify-between items-center mb-5 border-b-2 border-gray-100 pb-3">
                <h3 className="font-bold text-lg text-gray-800">
                  Editar Detalhes
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                  {selectedNode.type?.replace("Node", "")}
                </span>
              </div>

                <div className="flex flex-col gap-5 text-sm flex-1">
                {selectedNode && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="font-bold text-sky-800 block mb-2">
                        Título do nó
                      </label>
                      <input
                        className="w-full border-2 border-sky-200 p-3 rounded-lg focus:outline-none focus:border-sky-500 bg-white"
                        value={String(selectedNode.data.title || "")}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, {
                            title: e.target.value,
                          })
                        }
                        placeholder="Nome curto para identificar a intenção do nó"
                      />
                    </div>

                    <details className="bg-white border border-sky-100 rounded-md p-3">
                      <summary className="cursor-pointer text-xs font-bold text-sky-700">
                        Ficha de intenção (roteamento LLM)
                      </summary>
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Summary
                          </label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={String(selectedNode.data.summary || "")}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                summary: e.target.value,
                              })
                            }
                            rows={2}
                            placeholder="O que esse nó faz em 1 frase"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            When to use
                          </label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={String(selectedNode.data.when_to_use || "")}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                when_to_use: e.target.value,
                              })
                            }
                            rows={2}
                            placeholder="Em quais intenções esse nó deve ser escolhido"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Examples (1 por linha)
                          </label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={listToMultiline(selectedNode.data.examples)}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                examples: parseListInput(e.target.value),
                              })
                            }
                            rows={3}
                            placeholder={"Cadê meu pedido?\nQuero falar com atendente"}
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Keywords (separadas por vírgula)
                          </label>
                          <input
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={listToComma(selectedNode.data.keywords)}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                keywords: parseCommaListInput(e.target.value),
                              })
                            }
                            placeholder="pedido, rastreio, entrega"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Expected user state
                          </label>
                          <input
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={String(selectedNode.data.expected_user_state || "")}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                expected_user_state: e.target.value,
                              })
                            }
                            placeholder="neutral | waiting_order_id"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Next best nodes (ids separados por vírgula)
                          </label>
                          <input
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={listToComma(selectedNode.data.next_best_nodes)}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                next_best_nodes: parseCommaListInput(e.target.value),
                              })
                            }
                            placeholder="node-123, node-456"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Requires slots (separados por vírgula)
                          </label>
                          <input
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={listToComma(selectedNode.data.requires_slots)}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                requires_slots: parseCommaListInput(e.target.value),
                              })
                            }
                            placeholder="cidade, data, produto"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Bot voice template
                          </label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={String(selectedNode.data.bot_voice_template || "")}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                bot_voice_template: e.target.value,
                              })
                            }
                            rows={2}
                            placeholder="Texto base opcional para resposta do fluxo"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Confidence rules
                          </label>
                          <textarea
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={String(selectedNode.data.confidence_rules || "")}
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                confidence_rules: e.target.value,
                              })
                            }
                            rows={2}
                            placeholder="Regras para seleção automática deste nó"
                          />
                        </div>

                        <div>
                          <label className="font-semibold text-gray-700 block mb-1 text-xs">
                            Confidence threshold (0 a 1)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            className="w-full border border-gray-200 p-2 rounded-md focus:outline-none focus:border-sky-500 bg-gray-50 text-xs"
                            value={
                              typeof selectedNode.data.confidence_threshold === "number"
                                ? selectedNode.data.confidence_threshold
                                : ""
                            }
                            onChange={(e) =>
                              updateNodeData(selectedNode.id, {
                                confidence_threshold:
                                  e.target.value === ""
                                    ? undefined
                                    : Math.max(0, Math.min(1, Number(e.target.value))),
                              })
                            }
                            placeholder="0.85"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                {selectedNode && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <label className="font-bold text-gray-700 block mb-2">
                      Delay da Mensagem (milissegundos)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                      value={
                        typeof selectedNode.data.delayMs === "number"
                          ? selectedNode.data.delayMs
                          : 1500
                      }
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, {
                          delayMs:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      placeholder="1500"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Valor aplicado antes do envio ou execução do nó.
                    </p>
                  </div>
                )}

                {(selectedNode.type === "messageNode" ||
                  selectedNode.type === "startNode") && (
                  <div>
                    <label className="font-bold text-gray-700 block mb-2">
                      Mensagem a ser enviada
                    </label>
                    <textarea
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 min-h-[140px] resize-y bg-gray-50 placeholder:text-gray-400"
                      value={(selectedNode.data.message as string) || ""}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, {
                          message: e.target.value,
                        })
                      }
                      placeholder="Ex: Olá! Aguarde um momento..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Mensagem simples de texto que o cliente receberá.
                    </p>
                  </div>
                )}

                {selectedNode.type === "handoffNode" && (
                  <div>
                    <label className="font-bold text-gray-700 block mb-2">
                      Aviso de Transferência
                    </label>
                    <textarea
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-50"
                      value={(selectedNode.data.message as string) || ""}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, {
                          message: e.target.value,
                        })
                      }
                      rows={3}
                    />
                    <div className="bg-red-50 text-red-700 text-xs p-3 rounded mt-2 border border-red-100">
                      Após enviar esta mensagem, o bot será{" "}
                      <b className="font-bold">pausado</b> e passará o controle
                      para você no painel de atendimento.
                    </div>
                  </div>
                )}

                {selectedNode.type === "blockNode" && (
                  <div>
                    <label className="font-bold text-gray-700 block mb-2">
                      Conteúdo opcional
                    </label>
                    <textarea
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-slate-500 bg-gray-50"
                      value={
                        (selectedNode.data.message as string) ||
                        (selectedNode.data.content as string) ||
                        ""
                      }
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, {
                          message: e.target.value,
                          content: e.target.value,
                        })
                      }
                      rows={3}
                      placeholder="Opcional: mensagem final antes de bloquear o bot para humano"
                    />
                    <div className="bg-slate-50 text-slate-700 text-xs p-3 rounded mt-2 border border-slate-200">
                      Este nó ativa <b>is_human=true</b> na sessão e não envia
                      notificação de equipe.
                    </div>
                  </div>
                )}

                {selectedNode.type === "menuNode" && (
                  <>
                    <div>
                      <label className="font-bold text-gray-700 block mb-2">
                        Título exibido do menu (cliente)
                      </label>
                      <textarea
                        className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-50"
                        value={
                          (selectedNode.data.menu_title as string) ||
                          (selectedNode.data.message as string) ||
                          ""
                        }
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, {
                            menu_title: e.target.value,
                            message: e.target.value,
                          })
                        }
                        rows={2}
                        placeholder="Escolha uma opção:"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-gray-700 block">
                          Opções (Botões)
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs py-0 gap-1"
                          onClick={addMenuOption}
                        >
                          <PlusCircle size={14} /> Adicionar
                        </Button>
                      </div>

                      {Array.isArray(selectedNode.data.options) &&
                        selectedNode.data.options.map(
                          (opt: string, i: number) => (
                            <div
                              key={i}
                              className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200"
                            >
                              <span className="text-gray-400 font-bold text-xs">
                                {i + 1}.
                              </span>
                              <input
                                value={opt}
                                onChange={(e) =>
                                  updateMenuOption(i, e.target.value)
                                }
                                className="flex-1 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-1 text-sm text-gray-800"
                                placeholder={`Opção ${i + 1}`}
                              />
                              <button
                                onClick={() => removeMenuOption(i)}
                                className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ),
                        )}
                      {(!Array.isArray(selectedNode.data.options) ||
                        selectedNode.data.options.length === 0) && (
                        <p className="text-xs text-gray-500 italic text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          Nenhuma opção cadastrada.
                          <br />
                          Clique em "Adicionar".
                        </p>
                      )}
                    </div>
                  </>
                )}

                {selectedNode.type === "followUpNode" && (
                  <>
                    <div>
                      <label className="font-bold text-gray-700 block mb-2">
                        Tempo desde a última mensagem
                      </label>
                      {(() => {
                        const totalMinutes = resolveFollowUpInactivityMinutes(
                          selectedNode.data as Record<string, any>,
                        );
                        const currentHours = Math.floor(totalMinutes / 60);
                        const currentMinutes = totalMinutes % 60;

                        return (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">
                                Horas
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-amber-500 bg-gray-50"
                                value={currentHours}
                                onChange={(e) => {
                                  const nextHours =
                                    e.target.value === ""
                                      ? 0
                                      : Math.max(0, Number(e.target.value));
                                  const nextTotalMinutes =
                                    nextHours * 60 + currentMinutes;
                                  updateNodeData(selectedNode.id, {
                                    inactivityMinutes: Math.max(
                                      1,
                                      Math.round(nextTotalMinutes),
                                    ),
                                  });
                                }}
                                placeholder="Ex: 0"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">
                                Minutos
                              </label>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-amber-500 bg-gray-50"
                                value={currentMinutes}
                                onChange={(e) => {
                                  const rawMinutes =
                                    e.target.value === ""
                                      ? 0
                                      : Math.max(0, Number(e.target.value));
                                  const extraHours = Math.floor(rawMinutes / 60);
                                  const normalizedMinutes = rawMinutes % 60;
                                  const normalizedHours =
                                    currentHours + extraHours;
                                  const nextTotalMinutes =
                                    normalizedHours * 60 + normalizedMinutes;
                                  updateNodeData(selectedNode.id, {
                                    inactivityMinutes: Math.max(
                                      1,
                                      Math.round(nextTotalMinutes),
                                    ),
                                  });
                                }}
                                placeholder="Ex: 30"
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 block mb-2">
                        Mensagem do Follow Up (cliente)
                      </label>
                      <textarea
                        className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-amber-500 bg-gray-50"
                        value={
                          (selectedNode.data.message as string) ||
                          ""
                        }
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, {
                            message: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Ex: Ainda posso te ajudar por aqui 💛"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="font-bold text-gray-700 block">
                          Opções
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs py-0 gap-1"
                          onClick={addMenuOption}
                        >
                          <PlusCircle size={14} /> Adicionar
                        </Button>
                      </div>

                      {Array.isArray(selectedNode.data.options) &&
                        selectedNode.data.options.map(
                          (opt: string, i: number) => (
                            <div
                              key={i}
                              className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200"
                            >
                              <span className="text-gray-400 font-bold text-xs">
                                {i + 1}.
                              </span>
                              <input
                                value={opt}
                                onChange={(e) =>
                                  updateMenuOption(i, e.target.value)
                                }
                                className="flex-1 bg-transparent border-b border-gray-300 focus:border-amber-500 focus:outline-none px-1 py-1 text-sm text-gray-800"
                                placeholder={`Opção ${i + 1}`}
                              />
                              <button
                                onClick={() => removeMenuOption(i)}
                                className="text-red-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ),
                        )}
                      {(!Array.isArray(selectedNode.data.options) ||
                        selectedNode.data.options.length === 0) && (
                        <p className="text-xs text-gray-500 italic text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                          Nenhuma opção cadastrada.
                          <br />
                          Clique em "Adicionar".
                        </p>
                      )}
                    </div>
                  </>
                )}

                {selectedNode.type === "productSearchNode" && (
                  <div>
                    <label className="font-bold text-gray-700 block mb-2">
                      Termos de Busca
                    </label>
                    <input
                      className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50"
                      value={
                        (selectedNode.data.searchQuery as string) ||
                        (selectedNode.data.searchPrefix as string) ||
                        ""
                      }
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, {
                          searchQuery: e.target.value,
                        })
                      }
                      placeholder="Ex: buquê, rosas, presente"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Se a mensagem do usuário bater com estes termos, este nó
                      será acionado para sugerir produtos.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="font-bold text-gray-700 block mb-2">
                          Categoria
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                          value={selectedNode.data.categoryId || ""}
                          onChange={(e) =>
                            updateNodeData(selectedNode.id, {
                              categoryId: e.target.value,
                            })
                          }
                        >
                          <option value="">Todas</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block mb-2">
                          Tipo
                        </label>
                        <select
                          className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                          value={selectedNode.data.typeId || ""}
                          onChange={(e) =>
                            updateNodeData(selectedNode.id, {
                              typeId: e.target.value,
                            })
                          }
                        >
                          <option value="">Todos</option>
                          {types.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="font-bold text-gray-700 block mb-2">
                          Preço mínimo
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                          value={
                            typeof selectedNode.data.minPrice === "number"
                              ? selectedNode.data.minPrice
                              : ""
                          }
                          onChange={(e) =>
                            updateNodeData(selectedNode.id, {
                              minPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="R$ 0,00"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block mb-2">
                          Preço máximo
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                          value={
                            typeof selectedNode.data.maxPrice === "number"
                              ? selectedNode.data.maxPrice
                              : ""
                          }
                          onChange={(e) =>
                            updateNodeData(selectedNode.id, {
                              maxPrice:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                          placeholder="R$ 999,99"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <input
                        id="onlyActiveProducts"
                        type="checkbox"
                        className="h-4 w-4"
                        checked={Boolean(selectedNode.data.onlyActive)}
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, {
                            onlyActive: e.target.checked,
                          })
                        }
                      />
                      <label
                        htmlFor="onlyActiveProducts"
                        className="text-sm text-gray-700"
                      >
                        Somente produtos ativos
                      </label>
                    </div>

                    <div className="mt-4">
                      <label className="font-bold text-gray-700 block mb-2">
                        Máximo de resultados
                      </label>
                      <select
                        className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                        value={
                          typeof selectedNode.data.maxResults === "number"
                            ? String(selectedNode.data.maxResults)
                            : "all"
                        }
                        onChange={(e) =>
                          updateNodeData(selectedNode.id, {
                            maxResults:
                              e.target.value === "all"
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      >
                        <option value="all">Sem limite</option>
                        {[6, 12, 18, 24, 30].map((value) => (
                          <option key={value} value={value}>
                            {value} produtos
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        O teste exibe 6 produtos por página.
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="font-bold text-gray-700 block mb-2">
                        Página inicial
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="w-full border-2 border-gray-200 p-3 rounded-lg focus:outline-none focus:border-purple-500 bg-gray-50 text-sm"
                        value={
                          typeof selectedNode.data.page === "number"
                            ? selectedNode.data.page
                            : 1
                        }
                        onChange={(e) => {
                          const nextPage =
                            e.target.value === "" ? 1 : Number(e.target.value);
                          updateNodeData(selectedNode.id, { page: nextPage });
                          if (
                            selectedSearchTest &&
                            !selectedSearchTest.loading
                          ) {
                            changeSearchTestPage(nextPage);
                          }
                        }}
                        placeholder="Ex: 1"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Define qual página será exibida primeiro.
                      </p>
                    </div>

                    <div className="mt-5">
                      <Button
                        type="button"
                        onClick={() => runSearchTest(selectedNode.id)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        disabled={selectedSearchTest?.loading}
                      >
                        {selectedSearchTest?.loading
                          ? "Testando..."
                          : "Testar busca"}
                      </Button>
                      {!selectedSearchTest && (
                        <p className="text-xs text-purple-700 mt-2">
                          Use &quot;Testar busca&quot; para visualizar
                          resultados e paginação.
                        </p>
                      )}
                      {selectedSearchTest?.error && (
                        <p className="text-xs text-red-600 mt-2">
                          {selectedSearchTest.error}
                        </p>
                      )}
                      {selectedSearchTest &&
                        !selectedSearchTest.loading &&
                        !selectedSearchTest.error && (
                          <div className="mt-3 border border-purple-100 rounded-lg bg-purple-50/50 p-3">
                            {selectedSearchTest.results.length === 0 ? (
                              <div className="text-xs text-purple-700">
                                Nenhum produto encontrado.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-xs text-purple-700 font-semibold">
                                  Produtos retornados:
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                  {selectedSearchTest.results.map((product) => (
                                    <div
                                      key={product.id}
                                      className="bg-white border border-purple-100 rounded-md p-2 text-xs"
                                    >
                                      <div className="flex flex-col items-center gap-2">
                                        <h3 className="font-semibold">
                                          {product.name}
                                          {" - R$ "}
                                          <strong className="text-purple-500 font-bold">
                                            {product.price
                                              .toFixed(2)
                                              .replace(".", ",")}
                                          </strong>{" "}
                                        </h3>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {selectedSearchTest.totalPages > 1 && (
                                  <div className="flex items-center justify-between pt-2">
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-purple-700 disabled:text-purple-300"
                                      disabled={selectedSearchTest.page <= 1}
                                      onClick={() =>
                                        changeSearchTestPage(
                                          selectedSearchTest.page - 1,
                                        )
                                      }
                                    >
                                      Página anterior
                                    </button>
                                    <span className="text-[11px] text-purple-700">
                                      Página {selectedSearchTest.page} de{" "}
                                      {selectedSearchTest.totalPages}
                                    </span>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-purple-700 disabled:text-purple-300"
                                      disabled={
                                        selectedSearchTest.page >=
                                        selectedSearchTest.totalPages
                                      }
                                      onClick={() =>
                                        changeSearchTestPage(
                                          selectedSearchTest.page + 1,
                                        )
                                      }
                                    >
                                      Próxima página
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-4 border-t-2 border-red-50">
                <Button
                  variant="destructive"
                  className="w-full gap-2 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 border-none shadow-none"
                  onClick={removeSelectedNode}
                >
                  <Trash size={16} /> Excluir este Bloco
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full text-gray-400">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-500 mb-2">
                Nenhum nó selecionado
              </h3>
              <p className="text-xs">
                Clique em algum bloco no painel à esquerda para editar suas
                propriedades.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
