export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      acessos_site: {
        Row: {
          altura_tela: number | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          contador_visitas: number | null
          cookie_visitante: string | null
          criado_em: string
          dispositivo: string | null
          dominio_origem: string | null
          endereco_completo: string | null
          endereco_ip: string | null
          estado: string | null
          id: string
          largura_tela: number | null
          latitude: number | null
          longitude: number | null
          navegador: string | null
          pagina: string
          pais: string | null
          precisao_localizacao: string | null
          primeira_visita: boolean | null
          referrer: string | null
          regiao_planejamento: string | null
          rua: string | null
          sistema_operacional: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          altura_tela?: number | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          contador_visitas?: number | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          dominio_origem?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          largura_tela?: number | null
          latitude?: number | null
          longitude?: number | null
          navegador?: string | null
          pagina: string
          pais?: string | null
          precisao_localizacao?: string | null
          primeira_visita?: boolean | null
          referrer?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          altura_tela?: number | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          contador_visitas?: number | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          dominio_origem?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          largura_tela?: number | null
          latitude?: number | null
          longitude?: number | null
          navegador?: string | null
          pagina?: string
          pais?: string | null
          precisao_localizacao?: string | null
          primeira_visita?: boolean | null
          referrer?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      albuns: {
        Row: {
          atualizado_em: string
          capa_url: string | null
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          atualizado_em?: string
          capa_url?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          atualizado_em?: string
          capa_url?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      cliques_whatsapp: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cookie_visitante: string | null
          criado_em: string
          dispositivo: string | null
          dominio_origem: string | null
          endereco_completo: string | null
          endereco_ip: string | null
          estado: string | null
          id: string
          latitude: number | null
          longitude: number | null
          navegador: string | null
          pagina_origem: string | null
          pais: string | null
          precisao_localizacao: string | null
          regiao_planejamento: string | null
          rua: string | null
          secao_pagina: string | null
          sistema_operacional: string | null
          telefone_destino: string | null
          texto_botao: string | null
          tipo_clique: string | null
          url_destino: string | null
          user_agent: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          dominio_origem?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          navegador?: string | null
          pagina_origem?: string | null
          pais?: string | null
          precisao_localizacao?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          secao_pagina?: string | null
          sistema_operacional?: string | null
          telefone_destino?: string | null
          texto_botao?: string | null
          tipo_clique?: string | null
          url_destino?: string | null
          user_agent?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          dominio_origem?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          navegador?: string | null
          pagina_origem?: string | null
          pais?: string | null
          precisao_localizacao?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          secao_pagina?: string | null
          sistema_operacional?: string | null
          telefone_destino?: string | null
          texto_botao?: string | null
          tipo_clique?: string | null
          url_destino?: string | null
          user_agent?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          id: string
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          id?: string
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          id?: string
          valor?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          aprovado_por: string | null
          atualizado_em: string
          categoria: string | null
          chave_pix: string | null
          comprovante_url: string | null
          criado_em: string
          criado_por: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          dia_vencimento_recorrente: number | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          fornecedor_nome_livre: string | null
          id: string
          motivo: string
          observacoes: string | null
          pago_por: string | null
          recorrente: boolean | null
          status: string
          subcategoria: string | null
          valor: number
        }
        Insert: {
          aprovado_por?: string | null
          atualizado_em?: string
          categoria?: string | null
          chave_pix?: string | null
          comprovante_url?: string | null
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          dia_vencimento_recorrente?: number | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome_livre?: string | null
          id?: string
          motivo: string
          observacoes?: string | null
          pago_por?: string | null
          recorrente?: boolean | null
          status?: string
          subcategoria?: string | null
          valor: number
        }
        Update: {
          aprovado_por?: string | null
          atualizado_em?: string
          categoria?: string | null
          chave_pix?: string | null
          comprovante_url?: string | null
          criado_em?: string
          criado_por?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          dia_vencimento_recorrente?: number | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          fornecedor_nome_livre?: string | null
          id?: string
          motivo?: string
          observacoes?: string | null
          pago_por?: string | null
          recorrente?: boolean | null
          status?: string
          subcategoria?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_logs: {
        Row: {
          acao: string | null
          conta_id: string | null
          criado_em: string
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string | null
          usuario_id: string | null
        }
        Insert: {
          acao?: string | null
          conta_id?: string | null
          criado_em?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string | null
          conta_id?: string | null
          criado_em?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_logs_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_logs_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscais: {
        Row: {
          cadastrado_por: string | null
          colegio_eleitoral: string | null
          criado_em: string | null
          id: string
          lideranca_id: string | null
          municipio_id: string | null
          observacoes: string | null
          origem_captacao: string | null
          pessoa_id: string
          secao_fiscal: string | null
          status: string | null
          suplente_id: string | null
          zona_fiscal: string | null
        }
        Insert: {
          cadastrado_por?: string | null
          colegio_eleitoral?: string | null
          criado_em?: string | null
          id?: string
          lideranca_id?: string | null
          municipio_id?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id: string
          secao_fiscal?: string | null
          status?: string | null
          suplente_id?: string | null
          zona_fiscal?: string | null
        }
        Update: {
          cadastrado_por?: string | null
          colegio_eleitoral?: string | null
          criado_em?: string | null
          id?: string
          lideranca_id?: string | null
          municipio_id?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id?: string
          secao_fiscal?: string | null
          status?: string | null
          suplente_id?: string | null
          zona_fiscal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscais_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscais_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscais_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscais_suplente_id_fkey"
            columns: ["suplente_id"]
            isOneToOne: false
            referencedRelation: "suplentes"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          agencia: string | null
          banco: string | null
          conta: string | null
          cpf_cnpj: string | null
          criado_em: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          pix: string | null
          telefone: string | null
          tipo_pessoa: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
        }
        Relationships: []
      }
      galeria_analytics: {
        Row: {
          cidade: string | null
          cookie_visitante: string | null
          criado_em: string
          dispositivo: string | null
          duracao_visualizacao: number | null
          endereco_ip: string | null
          estado: string | null
          foto_id: string
          id: string
          navegador: string | null
          pais: string | null
          tipo_evento: string
        }
        Insert: {
          cidade?: string | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          duracao_visualizacao?: number | null
          endereco_ip?: string | null
          estado?: string | null
          foto_id: string
          id?: string
          navegador?: string | null
          pais?: string | null
          tipo_evento?: string
        }
        Update: {
          cidade?: string | null
          cookie_visitante?: string | null
          criado_em?: string
          dispositivo?: string | null
          duracao_visualizacao?: number | null
          endereco_ip?: string | null
          estado?: string | null
          foto_id?: string
          id?: string
          navegador?: string | null
          pais?: string | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_analytics_foto_id_fkey"
            columns: ["foto_id"]
            isOneToOne: false
            referencedRelation: "galeria_fotos"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria_fotos: {
        Row: {
          album_id: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          destaque_home: boolean
          evento: string | null
          id: string
          legenda: string | null
          ordem: number
          titulo: string
          url_foto: string
          visivel: boolean
        }
        Insert: {
          album_id?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          destaque_home?: boolean
          evento?: string | null
          id?: string
          legenda?: string | null
          ordem?: number
          titulo: string
          url_foto: string
          visivel?: boolean
        }
        Update: {
          album_id?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          destaque_home?: boolean
          evento?: string | null
          id?: string
          legenda?: string | null
          ordem?: number
          titulo?: string
          url_foto?: string
          visivel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_galeria_album"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albuns"
            referencedColumns: ["id"]
          },
        ]
      }
      hierarquia_usuarios: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          auth_user_id: string | null
          criado_em: string | null
          id: string
          municipio_id: string | null
          nome: string
          superior_id: string | null
          suplente_id: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          auth_user_id?: string | null
          criado_em?: string | null
          id?: string
          municipio_id?: string | null
          nome: string
          superior_id?: string | null
          suplente_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          auth_user_id?: string | null
          criado_em?: string | null
          id?: string
          municipio_id?: string | null
          nome?: string
          superior_id?: string | null
          suplente_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "hierarquia_usuarios_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hierarquia_usuarios_superior_id_fkey"
            columns: ["superior_id"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      liderancas: {
        Row: {
          apoiadores_estimados: number | null
          atualizado_em: string | null
          bairros_influencia: string | null
          cadastrado_por: string | null
          comunidades_influencia: string | null
          criado_em: string | null
          id: string
          lider_principal_id: string | null
          meta_votos: number | null
          municipio_id: string | null
          nivel: string | null
          nivel_comprometimento: string | null
          observacoes: string | null
          origem_captacao: string | null
          pessoa_id: string
          regiao_atuacao: string | null
          status: string | null
          suplente_id: string | null
          tipo_lideranca: string | null
          zona_atuacao: string | null
        }
        Insert: {
          apoiadores_estimados?: number | null
          atualizado_em?: string | null
          bairros_influencia?: string | null
          cadastrado_por?: string | null
          comunidades_influencia?: string | null
          criado_em?: string | null
          id?: string
          lider_principal_id?: string | null
          meta_votos?: number | null
          municipio_id?: string | null
          nivel?: string | null
          nivel_comprometimento?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id: string
          regiao_atuacao?: string | null
          status?: string | null
          suplente_id?: string | null
          tipo_lideranca?: string | null
          zona_atuacao?: string | null
        }
        Update: {
          apoiadores_estimados?: number | null
          atualizado_em?: string | null
          bairros_influencia?: string | null
          cadastrado_por?: string | null
          comunidades_influencia?: string | null
          criado_em?: string | null
          id?: string
          lider_principal_id?: string | null
          meta_votos?: number | null
          municipio_id?: string | null
          nivel?: string | null
          nivel_comprometimento?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id?: string
          regiao_atuacao?: string | null
          status?: string | null
          suplente_id?: string | null
          tipo_lideranca?: string | null
          zona_atuacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liderancas_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liderancas_lider_principal_id_fkey"
            columns: ["lider_principal_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liderancas_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liderancas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liderancas_suplente_id_fkey"
            columns: ["suplente_id"]
            isOneToOne: false
            referencedRelation: "suplentes"
            referencedColumns: ["id"]
          },
        ]
      }
      localizacoes_usuarios: {
        Row: {
          bateria_nivel: number | null
          criado_em: string
          em_movimento: boolean | null
          endereco_ip: string | null
          fonte: string | null
          id: string
          latitude: number
          longitude: number
          precisao: number | null
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          bateria_nivel?: number | null
          criado_em?: string
          em_movimento?: boolean | null
          endereco_ip?: string | null
          fonte?: string | null
          id?: string
          latitude: number
          longitude: number
          precisao?: number | null
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          bateria_nivel?: number | null
          criado_em?: string
          em_movimento?: boolean | null
          endereco_ip?: string | null
          fonte?: string | null
          id?: string
          latitude?: number
          longitude?: number
          precisao?: number | null
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "localizacoes_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_contato: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          criado_em: string
          dominio_origem: string | null
          email: string | null
          endereco_completo: string | null
          endereco_ip: string | null
          estado: string | null
          id: string
          latitude: number | null
          lida: boolean
          longitude: number | null
          mensagem: string
          nome: string
          pais: string | null
          precisao_localizacao: string | null
          regiao_planejamento: string | null
          rua: string | null
          telefone: string
          user_agent: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string
          dominio_origem?: string | null
          email?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          lida?: boolean
          longitude?: number | null
          mensagem: string
          nome: string
          pais?: string | null
          precisao_localizacao?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          telefone: string
          user_agent?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          criado_em?: string
          dominio_origem?: string | null
          email?: string | null
          endereco_completo?: string | null
          endereco_ip?: string | null
          estado?: string | null
          id?: string
          latitude?: number | null
          lida?: boolean
          longitude?: number | null
          mensagem?: string
          nome?: string
          pais?: string | null
          precisao_localizacao?: string | null
          regiao_planejamento?: string | null
          rua?: string | null
          telefone?: string
          user_agent?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      municipios: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          uf: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          uf?: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      pessoas: {
        Row: {
          atualizado_em: string
          colegio_eleitoral: string | null
          cpf: string | null
          criado_em: string
          data_nascimento: string | null
          email: string | null
          endereco_colegio: string | null
          facebook: string | null
          id: string
          instagram: string | null
          municipio_eleitoral: string | null
          nome: string
          observacoes_gerais: string | null
          origem: string | null
          outras_redes: string | null
          secao_eleitoral: string | null
          situacao_titulo: string | null
          telefone: string | null
          titulo_eleitor: string | null
          uf_eleitoral: string | null
          whatsapp: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          atualizado_em?: string
          colegio_eleitoral?: string | null
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_colegio?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          municipio_eleitoral?: string | null
          nome: string
          observacoes_gerais?: string | null
          origem?: string | null
          outras_redes?: string | null
          secao_eleitoral?: string | null
          situacao_titulo?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          uf_eleitoral?: string | null
          whatsapp?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          atualizado_em?: string
          colegio_eleitoral?: string | null
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_colegio?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          municipio_eleitoral?: string | null
          nome?: string
          observacoes_gerais?: string | null
          origem?: string | null
          outras_redes?: string | null
          secao_eleitoral?: string | null
          situacao_titulo?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          uf_eleitoral?: string | null
          whatsapp?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      possiveis_eleitores: {
        Row: {
          cadastrado_por: string | null
          compromisso_voto: string | null
          criado_em: string | null
          fiscal_id: string | null
          id: string
          lideranca_id: string | null
          municipio_id: string | null
          observacoes: string | null
          origem_captacao: string | null
          pessoa_id: string
          suplente_id: string | null
        }
        Insert: {
          cadastrado_por?: string | null
          compromisso_voto?: string | null
          criado_em?: string | null
          fiscal_id?: string | null
          id?: string
          lideranca_id?: string | null
          municipio_id?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id: string
          suplente_id?: string | null
        }
        Update: {
          cadastrado_por?: string | null
          compromisso_voto?: string | null
          criado_em?: string | null
          fiscal_id?: string | null
          id?: string
          lideranca_id?: string | null
          municipio_id?: string | null
          observacoes?: string | null
          origem_captacao?: string | null
          pessoa_id?: string
          suplente_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "possiveis_eleitores_cadastrado_por_fkey"
            columns: ["cadastrado_por"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "possiveis_eleitores_fiscal_id_fkey"
            columns: ["fiscal_id"]
            isOneToOne: false
            referencedRelation: "fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "possiveis_eleitores_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "possiveis_eleitores_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "possiveis_eleitores_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "possiveis_eleitores_suplente_id_fkey"
            columns: ["suplente_id"]
            isOneToOne: false
            referencedRelation: "suplentes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_painel: {
        Row: {
          cargo: Database["public"]["Enums"]["cargo_admin"]
          criado_em: string
          id: string
          user_id: string
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["cargo_admin"]
          criado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["cargo_admin"]
          criado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      roles_usuarios: {
        Row: {
          cargo: Database["public"]["Enums"]["cargo_admin"]
          criado_em: string
          id: string
          user_id: string
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["cargo_admin"]
          criado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["cargo_admin"]
          criado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sindspag_associados: {
        Row: {
          apoiadores: number | null
          atualizado_em: string
          colegio_eleitoral: string | null
          comprometimento: string | null
          cpf: string | null
          criado_em: string
          criado_por: string | null
          eh_socio_atual: boolean | null
          email: string | null
          facebook: string | null
          foi_socio_quando: string | null
          id: string
          instagram: string | null
          ja_foi_socio: boolean | null
          ligacao_politica: string | null
          meta_votos: number | null
          municipio: string | null
          nome: string
          observacoes: string | null
          posicao_ligacao: string | null
          regiao_atuacao: string | null
          secao_eleitoral: string | null
          situacao_titulo: string | null
          socio_desde: string | null
          status: string | null
          telefone: string | null
          titulo_eleitor: string | null
          uf: string | null
          whatsapp: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          apoiadores?: number | null
          atualizado_em?: string
          colegio_eleitoral?: string | null
          comprometimento?: string | null
          cpf?: string | null
          criado_em?: string
          criado_por?: string | null
          eh_socio_atual?: boolean | null
          email?: string | null
          facebook?: string | null
          foi_socio_quando?: string | null
          id?: string
          instagram?: string | null
          ja_foi_socio?: boolean | null
          ligacao_politica?: string | null
          meta_votos?: number | null
          municipio?: string | null
          nome: string
          observacoes?: string | null
          posicao_ligacao?: string | null
          regiao_atuacao?: string | null
          secao_eleitoral?: string | null
          situacao_titulo?: string | null
          socio_desde?: string | null
          status?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          uf?: string | null
          whatsapp?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          apoiadores?: number | null
          atualizado_em?: string
          colegio_eleitoral?: string | null
          comprometimento?: string | null
          cpf?: string | null
          criado_em?: string
          criado_por?: string | null
          eh_socio_atual?: boolean | null
          email?: string | null
          facebook?: string | null
          foi_socio_quando?: string | null
          id?: string
          instagram?: string | null
          ja_foi_socio?: boolean | null
          ligacao_politica?: string | null
          meta_votos?: number | null
          municipio?: string | null
          nome?: string
          observacoes?: string | null
          posicao_ligacao?: string | null
          regiao_atuacao?: string | null
          secao_eleitoral?: string | null
          situacao_titulo?: string | null
          socio_desde?: string | null
          status?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          uf?: string | null
          whatsapp?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sindspag_associados_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "sindspag_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      sindspag_usuarios: {
        Row: {
          cargo: string
          criado_em: string
          id: string
          nome: string
          senha_hash: string
        }
        Insert: {
          cargo?: string
          criado_em?: string
          id?: string
          nome: string
          senha_hash: string
        }
        Update: {
          cargo?: string
          criado_em?: string
          id?: string
          nome?: string
          senha_hash?: string
        }
        Relationships: []
      }
      suplente_municipio: {
        Row: {
          criado_em: string
          id: string
          municipio_id: string
          suplente_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          municipio_id: string
          suplente_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          municipio_id?: string
          suplente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suplente_municipio_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      suplentes: {
        Row: {
          ano_eleicao: number | null
          assinatura: string | null
          base_politica: string | null
          cargo_disputado: string | null
          created_at: string
          expectativa_votos: number | null
          fiscais_qtd: number | null
          fiscais_valor_unit: number | null
          id: string
          liderancas_qtd: number | null
          liderancas_valor_unit: number | null
          nome: string
          partido: string | null
          plotagem_qtd: number | null
          plotagem_valor_unit: number | null
          regiao_atuacao: string | null
          retirada_mensal_meses: number | null
          retirada_mensal_valor: number | null
          situacao: string | null
          telefone: string | null
          total_campanha: number | null
          total_votos: number | null
          updated_at: string
        }
        Insert: {
          ano_eleicao?: number | null
          assinatura?: string | null
          base_politica?: string | null
          cargo_disputado?: string | null
          created_at?: string
          expectativa_votos?: number | null
          fiscais_qtd?: number | null
          fiscais_valor_unit?: number | null
          id?: string
          liderancas_qtd?: number | null
          liderancas_valor_unit?: number | null
          nome: string
          partido?: string | null
          plotagem_qtd?: number | null
          plotagem_valor_unit?: number | null
          regiao_atuacao?: string | null
          retirada_mensal_meses?: number | null
          retirada_mensal_valor?: number | null
          situacao?: string | null
          telefone?: string | null
          total_campanha?: number | null
          total_votos?: number | null
          updated_at?: string
        }
        Update: {
          ano_eleicao?: number | null
          assinatura?: string | null
          base_politica?: string | null
          cargo_disputado?: string | null
          created_at?: string
          expectativa_votos?: number | null
          fiscais_qtd?: number | null
          fiscais_valor_unit?: number | null
          id?: string
          liderancas_qtd?: number | null
          liderancas_valor_unit?: number | null
          nome?: string
          partido?: string | null
          plotagem_qtd?: number | null
          plotagem_valor_unit?: number | null
          regiao_atuacao?: string | null
          retirada_mensal_meses?: number | null
          retirada_mensal_valor?: number | null
          situacao?: string | null
          telefone?: string | null
          total_campanha?: number | null
          total_votos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      usuario_modulos: {
        Row: {
          criado_em: string
          id: string
          modulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          modulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          modulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_modulos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "hierarquia_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          auth_user_id: string
          criado_em: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          auth_user_id: string
          criado_em?: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          auth_user_id?: string
          criado_em?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      usuarios_painel: {
        Row: {
          cargo: string
          criado_em: string
          id: string
          nome: string
          senha_hash: string
        }
        Insert: {
          cargo?: string
          criado_em?: string
          id?: string
          nome: string
          senha_hash: string
        }
        Update: {
          cargo?: string
          criado_em?: string
          id?: string
          nome?: string
          senha_hash?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_primeiro_admin: { Args: { _email: string }; Returns: undefined }
      eh_admin: { Args: { _user_id: string }; Returns: boolean }
      eh_admin_hierarquia: { Args: never; Returns: boolean }
      eh_admin_painel: { Args: { _user_id: string }; Returns: boolean }
      eh_super_admin: { Args: never; Returns: boolean }
      get_meu_suplente_id: { Args: never; Returns: string }
      get_meu_tipo: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_usuario"]
      }
      get_meu_usuario_id: { Args: never; Returns: string }
      get_subordinados: { Args: { usuario_id: string }; Returns: string[] }
      get_usuario_id: { Args: never; Returns: string }
      is_app_admin: { Args: never; Returns: boolean }
      sindspag_atualizar_cargo: {
        Args: { p_cargo: string; p_user_id: string }
        Returns: Json
      }
      sindspag_criar_usuario: {
        Args: { p_cargo?: string; p_nome: string; p_senha: string }
        Returns: Json
      }
      sindspag_deletar_usuario: { Args: { p_user_id: string }; Returns: Json }
      sindspag_login: {
        Args: { p_nome: string; p_senha: string }
        Returns: Json
      }
      sindspag_resetar_senha: {
        Args: { p_nova_senha: string; p_user_id: string }
        Returns: Json
      }
      tem_cargo: {
        Args: {
          _cargo: Database["public"]["Enums"]["cargo_admin"]
          _user_id: string
        }
        Returns: boolean
      }
      tem_cargo_painel: {
        Args: {
          _cargo: Database["public"]["Enums"]["cargo_admin"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      cargo_admin: "super_admin" | "admin" | "editor"
      tipo_usuario:
        | "super_admin"
        | "coordenador"
        | "suplente"
        | "lideranca"
        | "fiscal"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cargo_admin: ["super_admin", "admin", "editor"],
      tipo_usuario: [
        "super_admin",
        "coordenador",
        "suplente",
        "lideranca",
        "fiscal",
      ],
    },
  },
} as const
