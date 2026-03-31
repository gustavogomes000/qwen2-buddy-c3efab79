import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate JWT from main Supabase
    const mainUrl = Deno.env.get('SUPABASE_URL')!
    const mainServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mainClient = createClient(mainUrl, mainServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await mainClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: corsHeaders })
    }

    // Connect to external Supabase
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')!
    const externalClient = createClient(externalUrl, externalKey)

    const { data: contas, error } = await externalClient
      .from('contas_pagar')
      .select('id, descricao, motivo, valor, status, data_vencimento, data_pagamento, categoria, subcategoria, forma_pagamento, fornecedor_nome_livre, recorrente, criado_em')
      .order('data_vencimento', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Erro ao buscar contas externas:', error)
      return new Response(JSON.stringify({ error: 'Erro ao buscar pagamentos' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify(contas || []), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Erro:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders })
  }
})
