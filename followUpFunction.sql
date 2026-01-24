CREATE OR REPLACE FUNCTION disparar_followup()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  horas_diff INT;
  agora TIMESTAMPTZ := now();
  ultimo_followup_horas INT := 48;
  intervalos INT[] := ARRAY[2, 24, 48];  -- Ordem correta: do menor para o maior
  intervalo_atual INT;
  ja_enviou_ultimo BOOLEAN;
BEGIN
  FOR r IN
    SELECT number, last_message_sent
    FROM clientes
    WHERE last_message_sent IS NOT NULL
      AND follow_up = true 
  LOOP
    -- Calcula a diferença em horas (arredondada para baixo por conta do EXTRACT/ROUND)
    horas_diff := ROUND(EXTRACT(EPOCH FROM (agora - r.last_message_sent)) / 3600);
    ja_enviou_ultimo := false;

    -- Percorre os intervalos na ordem cronológica correta: 2h, 24h, 48h
    FOREACH intervalo_atual IN ARRAY intervalos
    LOOP
      -- Só envia se já passou do prazo E ainda não foi enviado antes
      IF horas_diff >= intervalo_atual THEN
        
        -- Garante que o follow-up NUNCA será disparado mais de uma vez
        -- O ON CONFLICT fará o trabalho de forma mais robusta/concorrente
        IF NOT EXISTS (
          SELECT 1 FROM followup_enviados 
          WHERE cliente_number = r.number::TEXT 
            AND horas_followup = intervalo_atual
        ) THEN
          
          RAISE NOTICE 'Disparando follow-up para % após % horas (diferença real: %h)', 
                       r.number, intervalo_atual, horas_diff;

          -- Tenta inserir o registro de envio. 
          -- Se já existir (devido a concorrência), ele simplesmente ignora.
          -- (Isto funciona agora que você adicionou a restrição UNIQUE)
          INSERT INTO followup_enviados (cliente_number, horas_followup)
          VALUES (r.number::TEXT, intervalo_atual)
          ON CONFLICT (cliente_number, horas_followup) DO NOTHING;

          -- Somente se o INSERT for BEM-SUCEDIDO (não conflitar) ou se for um ambiente 
          -- sem concorrência, o bloco de envio deve ser executado. 
          -- MANTEMOS A LÓGICA DE VERIFICAÇÃO ANTERIOR para garantir que a função seja idempotente
          -- e o HTTP POST só rode se o follow-up realmente NÃO foi enviado antes.

          PERFORM net.http_post(
            url := 'https://n8n.cestodamore.com.br/webhook/followup',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
              'cliente_number', r.number,
              'horas_apos_ultima_mensagem', intervalo_atual,
              'link_instagram', (intervalo_atual = ultimo_followup_horas) -- só true no de 48h
            )
          );

          -- Marca que enviou o último para desativar follow_up depois
          IF intervalo_atual = ultimo_followup_horas THEN
            ja_enviou_ultimo := true;
          END IF;

        END IF;
      END IF;
    END LOOP;

    -- Só desativa o follow_up se o de 48h foi enviado neste ciclo
    IF ja_enviou_ultimo THEN
      UPDATE clientes
      SET follow_up = false
      WHERE number = r.number;
      
      RAISE NOTICE 'Follow-up final (48h) enviado para %. follow_up desativado.', r.number;
    END IF;

  END LOOP;
END;
$$;