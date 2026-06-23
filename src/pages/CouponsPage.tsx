import { useEffect, useState } from "react";
import { useApi } from "../services/api";
import { Ticket, Plus, Edit2, Loader } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  coupon_type: string;
  discount_type: string;
  discount_value: number;
  max_discount_cap?: number;
  min_purchase_amount?: number;
  usage_limit?: number;
  valid_from?: string;
  valid_until?: string;
  is_visible: boolean;
  email?: string;
  status: string;
  _count?: { usages: number };
}

const initialForm = {
  code: "",
  description: "",
  coupon_type: "GLOBAL",
  discount_type: "PORCENTAGEM",
  discount_value: 0,
  max_discount_cap: 0,
  min_purchase_amount: 0,
  usage_limit: 0,
  valid_from: "",
  valid_until: "",
  is_visible: true,
  email: "",
  status: "ACTIVE",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-600",
  INACTIVE: "bg-neutral-100 text-neutral-500",
  EXPIRED: "bg-yellow-100 text-yellow-600",
  EXHAUSTED: "bg-red-100 text-red-600",
};

export default function CouponsPage() {
  const api = useApi();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await api.getCoupons();
      setCoupons(data);
    } catch {
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        code: formData.code,
        description: formData.description || undefined,
        coupon_type: formData.coupon_type,
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        min_purchase_amount: Number(formData.min_purchase_amount) || undefined,
        usage_limit: Number(formData.usage_limit) || undefined,
        valid_from: formData.valid_from || undefined,
        valid_until: formData.valid_until || undefined,
        is_visible: formData.is_visible,
        status: formData.status,
      };
      if (formData.discount_type === "PORCENTAGEM" && formData.max_discount_cap) {
        payload.max_discount_cap = Number(formData.max_discount_cap);
      }
      if (formData.coupon_type === "INDIVIDUAL" && formData.email) {
        payload.email = formData.email;
      }

      if (editingCoupon) {
        await api.updateCoupon(editingCoupon.id, payload);
        toast.success("Cupom atualizado");
      } else {
        await api.createCoupon(payload);
        toast.success("Cupom criado");
      }
      setIsModalOpen(false);
      setEditingCoupon(null);
      setFormData(initialForm);
      loadCoupons();
    } catch {
      toast.error("Erro ao salvar cupom");
    }
  };

  const toggleStatus = async (coupon: Coupon) => {
    const newStatus = coupon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api.updateCoupon(coupon.id, { status: newStatus });
      toast.success(`Cupom ${newStatus === "ACTIVE" ? "ativado" : "desativado"}`);
      loadCoupons();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const openEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || "",
      coupon_type: coupon.coupon_type,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      max_discount_cap: coupon.max_discount_cap || 0,
      min_purchase_amount: coupon.min_purchase_amount || 0,
      usage_limit: coupon.usage_limit || 0,
      valid_from: coupon.valid_from ? coupon.valid_from.split("T")[0] : "",
      valid_until: coupon.valid_until ? coupon.valid_until.split("T")[0] : "",
      is_visible: coupon.is_visible,
      email: coupon.email || "",
      status: coupon.status,
    });
    setIsModalOpen(true);
  };

  const formatDiscount = (coupon: Coupon) =>
    coupon.discount_type === "PORCENTAGEM"
      ? `${coupon.discount_value}%`
      : `R$ ${coupon.discount_value.toFixed(2)}`;

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader className="animate-spin" />
      </div>
    );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 flex items-center gap-3">
            <Ticket size={32} />
            Gestão de Cupons
          </h1>
          <p className="text-neutral-500">
            Crie e gerencie cupons de desconto
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCoupon(null);
            setFormData(initialForm);
            setIsModalOpen(true);
          }}
          className="bg-neutral-900 text-white gap-2 font-bold px-6 py-4 rounded-2xl"
        >
          <Plus size={20} />
          Novo Cupom
        </Button>
      </div>

      <div className="grid gap-4">
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400">
                <Ticket size={24} />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-lg">
                  {coupon.code}
                </h3>
                <div className="flex gap-4 text-sm text-neutral-500">
                  <span>{formatDiscount(coupon)}</span>
                  <span>{coupon.coupon_type}</span>
                  <span>Usos: {coupon._count?.usages ?? 0}</span>
                  {coupon.valid_until && (
                    <span>Até: {format(new Date(coupon.valid_until), "dd/MM/yyyy")}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${statusColors[coupon.status] || "bg-neutral-100 text-neutral-500"}`}
              >
                {coupon.status}
              </span>
              <button
                onClick={() => openEdit(coupon)}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <Edit2 size={18} className="text-neutral-500" />
              </button>
              <button
                onClick={() => toggleStatus(coupon)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors ${
                  coupon.status === "ACTIVE"
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                }`}
              >
                {coupon.status === "ACTIVE" ? "Desativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black mb-6">
              {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                  Código
                </label>
                <input
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="DESCONTO10"
                  className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                  Descrição
                </label>
                <input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do cupom"
                  className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Tipo de Cupom
                  </label>
                  <select
                    value={formData.coupon_type}
                    onChange={(e) => setFormData({ ...formData, coupon_type: e.target.value })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  >
                    <option value="GLOBAL">Global</option>
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="EVENTO">Evento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Tipo de Desconto
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  >
                    <option value="PORCENTAGEM">Porcentagem</option>
                    <option value="VALOR_FIXO">Valor Fixo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Valor do Desconto
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
                {formData.discount_type === "PORCENTAGEM" && (
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                      Teto de Desconto (R$)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.max_discount_cap}
                      onChange={(e) => setFormData({ ...formData, max_discount_cap: Number(e.target.value) })}
                      className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Compra Mínima (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.min_purchase_amount}
                    onChange={(e) => setFormData({ ...formData, min_purchase_amount: Number(e.target.value) })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Limite de Usos
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: Number(e.target.value) })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Válido De
                  </label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Válido Até
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
              </div>
              {formData.coupon_type === "INDIVIDUAL" && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                    Email do Cliente
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                  />
                </div>
              )}
              {(formData.coupon_type === "GLOBAL" || formData.coupon_type === "EVENTO") && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_visible}
                    onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                    className="w-5 h-5 rounded-lg"
                  />
                  <span className="text-sm font-bold text-neutral-600">Visível para clientes</span>
                </label>
              )}
              <div>
                <label className="block text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-neutral-50 border-none rounded-2xl px-4 py-3 focus:ring-2 ring-neutral-200 outline-none"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-neutral-100 text-neutral-600 py-4 font-bold rounded-2xl"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-neutral-900 text-white py-4 font-bold rounded-2xl shadow-lg shadow-neutral-900/20"
                >
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
