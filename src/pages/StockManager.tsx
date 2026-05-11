import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useApi,
  type InventoryEntry,
  type InventoryMovement,
  type InventoryStatus,
} from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { ArrowDown, Edit, History } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const statusLabel: Record<InventoryStatus, string> = {
  in_stock: "Em estoque",
  low_stock: "Estoque baixo",
  out_of_stock: "Sem estoque",
};

export function StockManager() {
  const api = useApi();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InventoryStatus | "">("");
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyRows, setHistoryRows] = useState<InventoryMovement[]>([]);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const response = await api.getInventory({
        per_page: 100,
        search: search || undefined,
        status: status || undefined,
      });
      setEntries(response.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar estoque");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const applyQuickAdjust = async (
    entry: InventoryEntry,
    operation: "increment" | "decrement" | "zero" | "set",
    quantity?: number,
  ) => {
    const reason = window.prompt(
      "Informe o motivo da alteração de estoque:",
      "Ajuste manual pelo manager",
    );
    if (!reason || !reason.trim()) {
      toast.error("Motivo é obrigatório");
      return;
    }

    try {
      await api.adjustInventory({
        entity_type: entry.entity_type || "item",
        entity_id: entry.id,
        operation,
        quantity,
        reason,
      });
      toast.success("Estoque atualizado");
      await loadInventory();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Erro ao ajustar estoque");
    }
  };

  const applyExactQuantity = async (entry: InventoryEntry) => {
    const exact = window.prompt(
      "Informe a quantidade exata final para este item/produto:",
      String(entry.physical ?? 0),
    );
    if (exact === null) return;

    const exactValue = Number(exact);
    if (!Number.isFinite(exactValue) || exactValue < 0) {
      toast.error("Quantidade exata inválida");
      return;
    }

    await applyQuickAdjust(entry, "set", Math.floor(exactValue));
  };

  const openHistory = async (entry: InventoryEntry) => {
    try {
      const response = await api.getInventoryMovements({
        per_page: 50,
        item_id: entry.id,
      });
      setHistoryRows(response.data || []);
      setHistoryTitle(`Histórico: ${entry.name}`);
      setHistoryOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar histórico");
    }
  };

  const statusBadgeClass = useMemo(
    () => ({
      in_stock: "bg-emerald-100 text-emerald-700",
      low_stock: "bg-amber-100 text-amber-700",
      out_of_stock: "bg-red-100 text-red-700",
    }),
    [],
  );

  return (
    <section className="m-6 space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-neutral-900">
          Controle de Estoque
        </h1>
        <p className="text-sm text-neutral-600">
          Ajustes rápidos com auditoria e cálculo de disponível considerando
          reservas ativas.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="h-10 rounded-md border border-neutral-300 px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as InventoryStatus | "")}
          >
            <option value="">Todos status</option>
            <option value="in_stock">Em estoque</option>
            <option value="low_stock">Estoque baixo</option>
            <option value="out_of_stock">Sem estoque</option>
          </select>
          <Button onClick={loadInventory} disabled={isLoading}>
            {isLoading ? "Carregando..." : "Atualizar"}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Físico</TableHead>
              <TableHead>Reservado</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="h-10 w-10 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                    {entry.image_url ? (
                      <img
                        src={entry.image_url}
                        alt={entry.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {entry.entity_type === "product" ? "Produto" : "Item"}
                </TableCell>
                <TableCell>{entry.name}</TableCell>
                <TableCell>{entry.category}</TableCell>
                <TableCell>{entry.physical}</TableCell>
                <TableCell>{entry.reserved}</TableCell>
                <TableCell>{entry.available}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass[entry.status]}`}
                  >
                    {statusLabel[entry.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickAdjust(entry, "increment", 1)}
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickAdjust(entry, "increment", 5)}
                    >
                      +5
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickAdjust(entry, "increment", 10)}
                    >
                      +10
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyQuickAdjust(entry, "decrement", 1)}
                    >
                      -1
                    </Button>

                    <div className="px-2">
                      <Separator orientation="vertical" className="h-full" />
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyExactQuantity(entry)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => applyQuickAdjust(entry, "zero")}
                    >
                      <ArrowDown className="h-4 w-4" /> 0
                    </Button>

                    <Button size="sm" onClick={() => openHistory(entry)}>
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{historyTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.quantity}</TableCell>
                    <TableCell>{row.reason}</TableCell>
                    <TableCell>
                      {row.admin?.name || row.admin?.email || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
