-- =====================================================================
-- Fotos dos contadores (Supabase Storage) — rodar depois do 0001
-- Caminho do arquivo: <ponto_id>/<leitura_id>/<maquina_id>.jpg
-- A primeira pasta é o ponto, e é por ela que o acesso é liberado.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('contadores', 'contadores', false)   -- bucket privado
on conflict (id) do nothing;

-- Ver foto: quem tem acesso ao ponto (admin, operador do ponto, dono do ponto)
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'contadores'
         and public.tem_acesso_ponto(((storage.foldername(name))[1])::uuid));

-- Enviar foto: admin ou operador do ponto (dono nunca envia)
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'contadores'
              and public.papel_atual() in ('admin', 'operador')
              and public.tem_acesso_ponto(((storage.foldername(name))[1])::uuid));

-- Apagar/trocar foto: só admin
create policy fotos_admin on storage.objects for all to authenticated
  using (bucket_id = 'contadores' and public.eh_admin())
  with check (bucket_id = 'contadores' and public.eh_admin());
