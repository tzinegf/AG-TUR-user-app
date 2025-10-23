import { supabase } from '../lib/supabase';

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'amount';
  value: number; // percent as 0-1 or amount in currency
  active?: boolean;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number | null;
  min_total?: number | null;
  applicable_trip_type?: 'one-way' | 'round-trip' | 'any' | null;
}

export interface ApplyCouponResult {
  valid: boolean;
  discount: number;
  error?: string;
  coupon?: Coupon | null;
}

function isExpired(expires_at?: string | null): boolean {
  if (!expires_at) return false;
  const dt = new Date(expires_at);
  return !isFinite(dt.getTime()) ? false : dt.getTime() < Date.now();
}

function normalizePercentValue(value: number): number {
  // Accept 0-1 (e.g., 0.2) or 0-100 (e.g., 20). Convert >1 to /100.
  if (value > 1) return Math.min(1, value / 100);
  return Math.max(0, value);
}

function computeDiscount(baseTotal: number, coupon: Coupon): number {
  if (coupon.type === 'percent') {
    const pct = normalizePercentValue(coupon.value);
    return Math.round(baseTotal * pct * 100) / 100;
  }
  // amount
  return Math.min(baseTotal, Math.max(0, Math.round(coupon.value * 100) / 100));
}

export const couponsService = {
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const upper = (code || '').trim().toUpperCase();
    if (!upper) return null;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', upper)
      .limit(1)
      .maybeSingle();

    if (error) {
      // Gracefully handle missing table or RLS
      const message = String((error as any)?.message || '');
      const missing = message.includes("Could not find the table 'public.coupons'");
      if (missing) {
        console.warn('Tabela coupons não encontrada. Aplicação seguirá sem buscar no banco.');
        return null;
      }
      console.error('Erro ao buscar cupom:', error);
      return null;
    }

    if (!data) return null;

    // Mapear schema proposto (discount_type, discount_value, status, ends_at, usage_limit, used_count)
    const row: any = data;
    const mapped: Coupon = {
      id: row.id,
      code: row.code,
      type: String(row.discount_type).toLowerCase() === 'percentage' ? 'percent' : 'amount',
      value: Number(row.discount_value ?? 0),
      active: row.status ? String(row.status).toLowerCase() === 'active' : true,
      expires_at: row.ends_at ?? null,
      max_uses: row.usage_limit ?? null,
      used_count: row.used_count ?? 0,
      min_total: row.min_total ?? null,
      applicable_trip_type: row.applicable_trip_type ?? 'any',
    };

    return mapped;
  },

  async applyCoupon(code: string, baseTotal: number, opts?: { tripType?: 'one-way' | 'round-trip' }): Promise<ApplyCouponResult> {
    try {
      const coupon = await this.getCouponByCode(code);
      if (!coupon) {
        return { valid: false, discount: 0, error: 'Cupom inválido ou inexistente no banco.', coupon: null };
      }

      // Validations
      if (coupon.active === false) {
        return { valid: false, discount: 0, error: 'Cupom inativo.', coupon };
      }
      if (isExpired(coupon.expires_at)) {
        return { valid: false, discount: 0, error: 'Cupom expirado.', coupon };
      }
      if (coupon.min_total && baseTotal < coupon.min_total) {
        return { valid: false, discount: 0, error: `Valor mínimo para uso do cupom: R$ ${Number(coupon.min_total).toFixed(2)}.`, coupon };
      }
      if (coupon.max_uses != null && coupon.used_count != null && coupon.used_count >= coupon.max_uses) {
        return { valid: false, discount: 0, error: 'Limite de uso do cupom atingido.', coupon };
      }
      if (coupon.applicable_trip_type && coupon.applicable_trip_type !== 'any') {
        if (opts?.tripType && coupon.applicable_trip_type !== opts.tripType) {
          return { valid: false, discount: 0, error: 'Cupom não aplicável para este tipo de viagem.', coupon };
        }
      }

      const discount = computeDiscount(baseTotal, coupon);
      return { valid: true, discount, coupon };
    } catch (e: any) {
      console.error('Falha ao aplicar cupom:', e);
      return { valid: false, discount: 0, error: 'Erro ao validar o cupom.' };
    }
  },

  async recordUsage(params: {
    coupon_id: string;
    booking_id?: string | null;
    user_id?: string | null;
    amount_before: number;
    amount_discount: number;
    amount_after: number;
  }): Promise<void> {
    try {
      const payload = {
        coupon_id: params.coupon_id,
        booking_id: params.booking_id ?? null,
        user_id: params.user_id ?? null,
        amount_before: Math.round(params.amount_before * 100) / 100,
        amount_discount: Math.round(params.amount_discount * 100) / 100,
        amount_after: Math.round(params.amount_after * 100) / 100,
      };

      const { error } = await supabase
        .from('coupon_usages')
        .insert([payload]);

      if (error) {
        const message = String((error as any)?.message || '');
        const missing = message.includes("Could not find the table 'public.coupon_usages'");
        if (missing) {
          console.warn('Tabela coupon_usages não encontrada; uso de cupom não registrado.');
          return;
        }
        throw error;
      }
    } catch (e) {
      console.error('Erro ao registrar uso de cupom:', e);
    }
  },
};