import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(dbUrl);
  await client.connect();

  const results: string[] = [];

  const statements = [
    `DROP POLICY IF EXISTS "Admin ve todos usuarios" ON public.hierarquia_usuarios`,
    `CREATE POLICY "Admin ve todos usuarios" ON public.hierarquia_usuarios FOR SELECT TO authenticated USING (
      eh_admin_hierarquia() OR (id = get_meu_usuario_id()) OR (id IN (SELECT get_subordinados(get_meu_usuario_id())))
    )`,
    `DROP POLICY IF EXISTS "Admin insere usuarios" ON public.hierarquia_usuarios`,
    `CREATE POLICY "Admin insere usuarios" ON public.hierarquia_usuarios FOR INSERT TO authenticated WITH CHECK (
      eh_admin_hierarquia()
    )`,
    `DROP POLICY IF EXISTS "Admin atualiza usuarios" ON public.hierarquia_usuarios`,
    `CREATE POLICY "Admin atualiza usuarios" ON public.hierarquia_usuarios FOR UPDATE TO authenticated USING (
      eh_admin_hierarquia() OR (id = get_meu_usuario_id())
    )`,
    `DROP POLICY IF EXISTS "Admin deleta usuarios" ON public.hierarquia_usuarios`,
    `CREATE POLICY "Admin deleta usuarios" ON public.hierarquia_usuarios FOR DELETE TO authenticated USING (
      eh_admin_hierarquia()
    )`,
  ];

  for (const sql of statements) {
    try {
      await client.queryObject(sql);
      results.push(`OK: ${sql.substring(0, 60)}...`);
    } catch (e: any) {
      results.push(`ERR: ${sql.substring(0, 60)}... → ${e.message}`);
    }
  }

  await client.end();

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
