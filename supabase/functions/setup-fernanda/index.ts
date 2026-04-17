// One-shot migration: create cadastros_fernanda table + RLS + add 'fernanda' enum value
// Uses Deno postgres driver to execute DDL with service-role privileges.
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ ok: false, error: "SUPABASE_DB_URL missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = new Client(dbUrl);
  await client.connect();

  const statements: { label: string; sql: string }[] = [
    {
      label: "add_enum_fernanda",
      sql: `DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'fernanda'
                  AND enumtypid = 'public.tipo_usuario'::regtype
              ) THEN
                ALTER TYPE public.tipo_usuario ADD VALUE 'fernanda';
              END IF;
            END $$;`,
    },
    {
      label: "create_table",
      sql: `CREATE TABLE IF NOT EXISTS public.cadastros_fernanda (
              id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              nome text NOT NULL,
              telefone text NOT NULL,
              cidade text,
              instagram text,
              cadastrado_por uuid,
              criado_em timestamptz NOT NULL DEFAULT now(),
              atualizado_em timestamptz NOT NULL DEFAULT now()
            );`,
    },
    { label: "idx_criado_em", sql: `CREATE INDEX IF NOT EXISTS idx_cadastros_fernanda_criado_em ON public.cadastros_fernanda (criado_em DESC);` },
    { label: "idx_cad_por", sql: `CREATE INDEX IF NOT EXISTS idx_cadastros_fernanda_cadastrado_por ON public.cadastros_fernanda (cadastrado_por);` },
    { label: "enable_rls", sql: `ALTER TABLE public.cadastros_fernanda ENABLE ROW LEVEL SECURITY;` },
    { label: "drop_pol_select", sql: `DROP POLICY IF EXISTS "Fernanda e admin selecionam" ON public.cadastros_fernanda;` },
    {
      label: "pol_select",
      sql: `CREATE POLICY "Fernanda e admin selecionam" ON public.cadastros_fernanda
              FOR SELECT TO authenticated
              USING (
                eh_admin_hierarquia()
                OR cadastrado_por = get_meu_usuario_id()
                OR EXISTS (SELECT 1 FROM hierarquia_usuarios h WHERE h.auth_user_id = auth.uid() AND h.tipo::text = 'fernanda')
              );`,
    },
    { label: "drop_pol_insert", sql: `DROP POLICY IF EXISTS "Fernanda e admin inserem" ON public.cadastros_fernanda;` },
    {
      label: "pol_insert",
      sql: `CREATE POLICY "Fernanda e admin inserem" ON public.cadastros_fernanda
              FOR INSERT TO authenticated
              WITH CHECK (
                eh_admin_hierarquia()
                OR EXISTS (SELECT 1 FROM hierarquia_usuarios h WHERE h.auth_user_id = auth.uid() AND h.tipo::text = 'fernanda')
              );`,
    },
    { label: "drop_pol_update", sql: `DROP POLICY IF EXISTS "Fernanda e admin atualizam" ON public.cadastros_fernanda;` },
    {
      label: "pol_update",
      sql: `CREATE POLICY "Fernanda e admin atualizam" ON public.cadastros_fernanda
              FOR UPDATE TO authenticated
              USING (
                eh_admin_hierarquia()
                OR EXISTS (SELECT 1 FROM hierarquia_usuarios h WHERE h.auth_user_id = auth.uid() AND h.tipo::text = 'fernanda')
              );`,
    },
    { label: "drop_pol_delete", sql: `DROP POLICY IF EXISTS "Admin deleta cadastros_fernanda" ON public.cadastros_fernanda;` },
    {
      label: "pol_delete",
      sql: `CREATE POLICY "Admin deleta cadastros_fernanda" ON public.cadastros_fernanda
              FOR DELETE TO authenticated
              USING (
                eh_admin_hierarquia()
                OR EXISTS (SELECT 1 FROM hierarquia_usuarios h WHERE h.auth_user_id = auth.uid() AND h.tipo::text = 'fernanda')
              );`,
    },
    {
      label: "trigger_atualizado_em",
      sql: `CREATE OR REPLACE FUNCTION public.fn_cadastros_fernanda_set_updated_at()
              RETURNS TRIGGER LANGUAGE plpgsql AS $$
              BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$;`,
    },
    {
      label: "drop_trg",
      sql: `DROP TRIGGER IF EXISTS trg_cadastros_fernanda_updated ON public.cadastros_fernanda;`,
    },
    {
      label: "create_trg",
      sql: `CREATE TRIGGER trg_cadastros_fernanda_updated
              BEFORE UPDATE ON public.cadastros_fernanda
              FOR EACH ROW EXECUTE FUNCTION public.fn_cadastros_fernanda_set_updated_at();`,
    },
  ];

  const results: any[] = [];
  for (const s of statements) {
    try {
      await client.queryArray(s.sql);
      results.push({ step: s.label, ok: true });
    } catch (err) {
      results.push({ step: s.label, ok: false, error: (err as Error).message });
    }
  }

  await client.end();

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
