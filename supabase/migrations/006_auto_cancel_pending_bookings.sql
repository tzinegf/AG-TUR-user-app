-- 006_auto_cancel_pending_bookings.sql
-- Cancela automaticamente reservas com status pendente após 20 minutos sem pagamento
-- e libera assentos e marca pagamentos como failed.

create or replace function cancel_expired_pending_bookings()
returns void
language plpgsql
as $$
begin
  -- Cancelar reservas pendentes/ativas sem pagamento com mais de 20 minutos
  update bookings b
  set status = 'cancelled', updated_at = now()
  where (b.status = 'pending' or b.status = 'active')
    and (coalesce(b.payment_status, '') not in ('paid','completed'))
    and b.created_at <= now() - interval '20 minutes';

  -- Marcar pagamentos vinculados como failed quando ainda estiverem pendentes
  update payments p
  set status = 'failed', updated_at = now()
  where p.status = 'pending'
    and p.booking_id in (
      select id from bookings
      where status = 'cancelled'
        and created_at <= now() - interval '20 minutes'
    );

  -- Liberar assentos removendo os vínculos em booking_seats
  delete from booking_seats bs
  using bookings b
  where bs.booking_id = b.id
    and b.status = 'cancelled'
    and b.created_at <= now() - interval '20 minutes';
  -- Os triggers existentes em booking_seats/seats cuidam de atualizar disponibilidade
end;
$$;

-- Tentar criar/scheduling com pg_cron para executar a cada minuto
-- Tolerar ambientes onde a extensão não está disponível
DO $$
BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron não disponível; prosseguindo sem extensão';
  END;

  BEGIN
    PERFORM cron.schedule(
      'auto_cancel_pending_bookings',
      '* * * * *',
      $$SELECT cancel_expired_pending_bookings();$$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível agendar job no pg_cron; execute manualmente ou via Edge Function.';
  END;
END;
$$;