import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY');

    if (!externalUrl || !externalKey) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const externalSupabase = createClient(externalUrl, externalKey);

    // Fetch liderancas and pessoas separately to avoid FK join issues
    const [lRes, pRes] = await Promise.all([
      externalSupabase.from('liderancas').select('*'),
      externalSupabase.from('pessoas').select('id, nome, telefone, whatsapp, email'),
    ]);

    if (lRes.error && pRes.error) {
      // Both failed - try direct query on liderancas with nome column
      const { data, error } = await externalSupabase
        .from('liderancas')
        .select('id, nome, regiao_atuacao, whatsapp')
        .order('nome');

      if (error) {
        console.error('Fallback also failed:', error);
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(
        (data || []).map((l: any) => ({
          id: l.id,
          nome: l.nome || '—',
          regiao_atuacao: l.regiao_atuacao || l.regiao || null,
          whatsapp: l.whatsapp || null,
        }))
      ), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If pessoas loaded, merge; otherwise use liderancas directly
    if (!lRes.error && lRes.data) {
      const pessoasById = new Map(
        (pRes.data ?? []).map((p: any) => [p.id, p])
      );

      const result = (lRes.data || []).map((l: any) => {
        const pessoa = pessoasById.get(l.pessoa_id);
        return {
          id: l.id,
          nome: pessoa?.nome || l.nome || '—',
          regiao_atuacao: l.regiao_atuacao || l.regiao || null,
          whatsapp: pessoa?.whatsapp || l.whatsapp || null,
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
