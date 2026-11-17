-- =====================================================================
-- Backup semanal automático — só no Supabase (usa a extensão pg_cron).
-- Todo domingo às 03:00 (horário de Brasília = 06:00 UTC).
-- =====================================================================
create extension if not exists pg_cron;
select cron.schedule('backup-semanal', '0 6 * * 0', $$select public.gerar_backup('semanal')$$);
