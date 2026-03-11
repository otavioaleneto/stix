# Cloudflare Tunnel - Guia de Instalacao na VPS

O Cloudflare Tunnel cria uma conexao segura entre a VPS e a rede do Cloudflare. Isso faz com que os clientes (Xbox, navegadores) se conectem ao servidor Cloudflare **mais proximo deles** em vez de conectar diretamente na VPS.

## Por que usar Cloudflare Tunnel?

**Problema**: A VPS esta em Dallas (EUA) e os usuarios/Xbox estao no Brasil. A rota de rede entre o ISP do Xbox e o datacenter da VPS e ruim, resultando em velocidades de download de apenas 300 KB/s.

**Solucao**: Com Cloudflare Tunnel, o fluxo muda:

```
SEM Tunnel (lento):
Xbox (Brasil) → Internet publica (rota ruim, 153ms) → VPS (Dallas) = 300 KB/s

COM Tunnel (rapido):
Xbox (Brasil) → Cloudflare Edge no Brasil (perto!) → Backbone Cloudflare → VPS (Dallas) via tunnel
```

O Xbox se conecta ao servidor Cloudflare mais proximo (no Brasil, com baixa latencia), e o Cloudflare usa sua rede privada otimizada para chegar ate a VPS em Dallas.

## Vantagens sobre outras solucoes

- **Diferente do WARP**: WARP muda o roteamento da VPS; Tunnel muda o roteamento do **cliente**
- **Diferente da nuvem laranja (DNS proxy)**: Tunnel e um produto oficial do Cloudflare projetado para aplicacoes, nao apenas paginas HTML
- **Sem limite de tamanho**: Downloads grandes (1GB+) funcionam normalmente
- **Sem limite de bandwidth**: Trafego ilimitado no plano gratuito
- **Sem risco de ban**: Uso legitimo, suportado pela Cloudflare
- **Gratuito**: O Tunnel basico e gratuito. Argo Smart Routing e opcional ($5/mes + $0.10/GB)

## Custo

| Opcao | Custo | Beneficio |
|-------|-------|-----------|
| Tunnel Gratuito | $0 | Xbox conecta ao Cloudflare mais proximo, backbone ate a VPS |
| Tunnel + Argo Smart Routing | $5/mes + $0.10/GB | Roteamento otimizado em tempo real, ~30% mais rapido |

**Exemplo de custo com Argo**: Se seus usuarios baixam 500 GB/mes, o custo seria $5 + $50 = $55/mes. Para 100 GB/mes: $5 + $10 = $15/mes.

**Recomendacao**: Comece com o Tunnel gratuito. Se a velocidade melhorar mas nao for suficiente, ative o Argo.

---

## Pre-requisitos

- VPS com Ubuntu Server 22.04 ou 24.04
- Dominio configurado no Cloudflare (o DNS precisa estar gerenciado pelo Cloudflare)
- nginx CDN Proxy ja configurado (Passo 15 do INSTALL_VPS.md)
- Conta Cloudflare (gratuita)

**IMPORTANTE**: O dominio `speedygamesdownloads.com` precisa ter seus DNS nameservers apontando para o Cloudflare. Se ainda nao fez isso, va ao Cloudflare Dashboard, adicione o dominio e siga as instrucoes para mudar os nameservers.

---

## Passo 1: Instalar o cloudflared

Conecte na VPS como root e instale o `cloudflared`:

```bash
# Adicionar repositorio do Cloudflare
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Instalar
sudo apt update
sudo apt install -y cloudflared
```

Verifique a instalacao:

```bash
cloudflared --version
```

## Passo 2: Autenticar com o Cloudflare

```bash
cloudflared tunnel login
```

Isso vai abrir uma URL no terminal. Copie e cole no navegador do seu computador. Selecione o dominio `speedygamesdownloads.com` e autorize.

Apos autorizar, o terminal vai mostrar uma mensagem de sucesso e salvar o certificado em `~/.cloudflared/cert.pem`.

## Passo 3: Criar o Tunnel

```bash
cloudflared tunnel create godsend-cdn
```

Anote o **Tunnel ID** (UUID) que aparece, algo como: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

Verifique se foi criado:

```bash
cloudflared tunnel list
```

## Passo 4: Configurar o DNS

Aponte o dominio CDN para o tunnel:

```bash
cloudflared tunnel route dns godsend-cdn cdn.speedygamesdownloads.com
```

Isso cria automaticamente um registro CNAME no Cloudflare DNS apontando `cdn.speedygamesdownloads.com` para o tunnel.

**IMPORTANTE**: Se ja existe um registro A para `cdn.speedygamesdownloads.com`, delete-o primeiro no Cloudflare Dashboard (DNS > Records) antes de executar este comando.

## Passo 5: Criar arquivo de configuracao

```bash
nano ~/.cloudflared/config.yml
```

Cole o seguinte conteudo (substitua o UUID pelo seu Tunnel ID do Passo 3):

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890
credentials-file: /root/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json

ingress:
  - hostname: cdn.speedygamesdownloads.com
    service: http://localhost:80
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false
      keepAliveTimeout: 90s
      httpHostHeader: cdn.speedygamesdownloads.com
  - service: http_status:404
```

**Explicacao**:
- `service: http://localhost:80` — O tunnel envia o trafego para o nginx rodando na porta 80
- O nginx CDN Proxy ja configurado no Passo 15 do INSTALL_VPS.md vai receber e proxy para o Quotaless
- A ultima regra (`http_status:404`) e o fallback obrigatorio para qualquer outro dominio

Salve: `Ctrl+O`, `Enter`, `Ctrl+X`.

## Passo 6: Testar o Tunnel

Teste manualmente antes de configurar como servico:

```bash
cloudflared tunnel run godsend-cdn
```

Deve mostrar logs indicando que o tunnel esta conectado. Abra outro terminal e teste:

```bash
curl -I http://cdn.speedygamesdownloads.com
```

Deve retornar uma resposta HTTP (200, 301, ou similar). Se funcionar, pressione `Ctrl+C` para parar o tunnel.

## Passo 7: Instalar como servico systemd

Primeiro, copie a configuracao para o diretorio do servico:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/*.json /etc/cloudflared/
```

Agora instale o servico:

```bash
cloudflared service install
```

Isso cria e inicia o servico `cloudflared`. Verifique:

```bash
systemctl status cloudflared
```

Deve mostrar `active (running)`.

Se precisar reiniciar apos mudancas na configuracao:

```bash
sudo systemctl restart cloudflared
sudo systemctl enable cloudflared
```

## Passo 8: Configurar HTTP no Cloudflare

O Xbox 360 nao suporta HTTPS. Configure o Cloudflare para permitir HTTP:

### 8.1: Manter SSL/TLS Mode seguro

**NAO mude o modo SSL global da zona**. Mantenha em **Full** ou **Full (Strict)** para proteger os outros subdominios. Vamos criar uma regra especifica apenas para o dominio CDN.

### 8.2: Criar regra HTTP apenas para o CDN

Crie uma Configuration Rule para permitir HTTP **somente** no dominio CDN (sem afetar o resto do site):

1. Acesse o Cloudflare Dashboard: https://dash.cloudflare.com
2. Selecione o dominio `speedygamesdownloads.com`
3. Va em **Rules > Configuration Rules**
4. Clique **Create Rule**
5. Nome: "CDN HTTP para Xbox"
6. Condicao: Hostname equals `cdn.speedygamesdownloads.com`
7. Configuracoes:
   - **SSL**: Off (ou Flexible)
   - **Automatic HTTPS Rewrites**: Off
8. Salve e publique

Isso permite que o Xbox se conecte via HTTP ao dominio CDN, enquanto todos os outros dominios continuam seguros com HTTPS.

### 8.3: Desativar redirecionamento HTTPS para o CDN

Se o Cloudflare ainda estiver redirecionando HTTP→HTTPS para o CDN, crie uma Page Rule adicional:

1. Va em **Rules > Page Rules**
2. Clique **Create Page Rule**
3. URL: `http://cdn.speedygamesdownloads.com/*`
4. Configuracao: **SSL: Off**
5. Salve

**IMPORTANTE**: NAO desative "Always Use HTTPS" globalmente. Isso afetaria todos os dominios. Use as regras acima para aplicar apenas ao CDN.

### 8.4: Desativar cache para URLs com JWT

Os downloads usam URLs com tokens JWT que mudam a cada requisicao. O cache deve ser desativado:

1. Va em **Rules > Page Rules** (ou **Cache Rules**)
2. Clique **Create Rule**
3. URL: `cdn.speedygamesdownloads.com/*pydio_jwt*`
4. Configuracao: **Cache Level: Bypass**
5. Salve

Ou via Cache Rules:
1. Va em **Caching > Cache Rules**
2. Clique **Create Rule**
3. Nome: "Bypass cache CDN downloads"
4. Condicao: Hostname equals `cdn.speedygamesdownloads.com`
5. Cache eligibility: **Bypass cache**
6. Salve e publique

---

## Passo 9: Testar no Xbox

Apos configurar tudo, teste o download no Xbox:

1. Abra o plugin GODSend no Xbox
2. Tente baixar um arquivo
3. Verifique a velocidade no progresso do download
4. Compare com a velocidade anterior (300 KB/s)

Se a velocidade melhorou, o Cloudflare Tunnel esta funcionando!

### Teste de velocidade via terminal

```bash
# Na VPS, verificar se o tunnel esta ativo
cloudflared tunnel info godsend-cdn

# De outro computador, testar o CDN
curl -o /dev/null -w "Velocidade: %{speed_download} bytes/s\n" "http://cdn.speedygamesdownloads.com/io/personal-files/caminho/arquivo"

# Verificar se o Cloudflare esta servindo (procure header cf-ray)
curl -I http://cdn.speedygamesdownloads.com
```

Nos headers da resposta, procure:
- `cf-ray: xxxxx` — Confirma que o Cloudflare esta servindo
- `server: cloudflare` — Confirma proxy Cloudflare

---

## Passo 10: Argo Smart Routing (Opcional)

Se a velocidade melhorou com o tunnel gratuito mas voce quer mais, ative o Argo Smart Routing:

1. Acesse o Cloudflare Dashboard
2. Va em **Traffic > Argo Smart Routing**
3. Ative o toggle
4. Confirme o faturamento ($5/mes + $0.10/GB)

O Argo otimiza o roteamento em tempo real, monitorando a rede a cada 60 segundos e escolhendo o caminho mais rapido. Melhoria tipica: ~30% mais rapido.

**Dica**: Monitore o consumo no dashboard do Cloudflare para evitar surpresas na conta.

---

## Arquitetura Final

```
Xbox 360 (Brasil)
    |
    | HTTP (porta 80)
    v
Cloudflare Edge Server (Brasil, baixa latencia)
    |
    | Cloudflare Backbone (rede privada otimizada)
    | [Com Argo: roteamento inteligente em tempo real]
    v
Cloudflare Edge Server (proximo da VPS)
    |
    | Cloudflare Tunnel (conexao segura)
    v
VPS nginx (Dallas, porta 80)
    |
    | HTTPS (proxy reverso)
    v
Pydio Cells / Quotaless (drive.quotaless.cloud)
    |
    | Arquivo do jogo
    v
Resposta volta pelo mesmo caminho otimizado
```

---

## Comandos Uteis

```bash
# Ver status do tunnel
cloudflared tunnel info godsend-cdn

# Ver tunnels criados
cloudflared tunnel list

# Ver logs do tunnel em tempo real
sudo journalctl -u cloudflared -f

# Ver ultimas 50 linhas de log
sudo journalctl -u cloudflared -n 50

# Reiniciar o tunnel
sudo systemctl restart cloudflared

# Parar o tunnel
sudo systemctl stop cloudflared

# Verificar se o Cloudflare esta servindo o CDN
curl -I http://cdn.speedygamesdownloads.com 2>/dev/null | grep -E "server:|cf-ray:"
```

---

## Troubleshooting

### Tunnel nao conecta

```bash
# Ver logs detalhados
sudo journalctl -u cloudflared -n 100

# Verificar configuracao de ingress
cloudflared tunnel ingress validate

# Testar regra de roteamento para um hostname
cloudflared tunnel ingress rule http://cdn.speedygamesdownloads.com

# Testar manualmente
cloudflared tunnel run godsend-cdn
```

Problemas comuns:
- Credentials file nao encontrado: verifique o caminho no config.yml
- DNS nao configurado: execute `cloudflared tunnel route dns godsend-cdn cdn.speedygamesdownloads.com`

### Xbox nao consegue baixar (timeout ou erro)

1. Verifique se o tunnel esta rodando: `systemctl status cloudflared`
2. Verifique se o SSL esta em modo Flexible: Cloudflare Dashboard > SSL/TLS
3. Verifique se "Always Use HTTPS" esta desativado
4. Teste com curl: `curl -I http://cdn.speedygamesdownloads.com`
5. Se aparecer redirect 301 para HTTPS, as configuracoes de SSL nao estao corretas

### Velocidade nao melhorou

1. Verifique se o trafego esta passando pelo Cloudflare:
```bash
curl -I http://cdn.speedygamesdownloads.com 2>/dev/null | grep cf-ray
```
Se nao aparecer `cf-ray`, o DNS pode nao estar apontando para o tunnel.

2. O tunnel gratuito usa roteamento padrao. Considere ativar o Argo Smart Routing para roteamento otimizado.

3. Verifique a velocidade da VPS para o Quotaless:
```bash
curl -o /dev/null -w "Velocidade: %{speed_download} bytes/s\n" "https://drive.quotaless.cloud/..."
```
Se a VPS → Quotaless estiver lenta, o problema nao e a rota ate o Xbox.

### Erro 502 Bad Gateway

O nginx nao esta respondendo. Verifique:
```bash
# nginx rodando?
systemctl status nginx

# CMS rodando?
su - godsend -c "pm2 status"
```

### Downloads iniciam mas travam

Pode ser timeout. Verifique o config.yml:
- `connectTimeout` deve ser alto (30s+)
- `keepAliveTimeout` deve ser alto (90s+)

No nginx CDN proxy, verifique os timeouts:
```bash
# Deve ter timeouts altos
grep -i timeout /etc/nginx/sites-available/godsend-cdn
```

---

## Remover o Tunnel

Se quiser remover o Cloudflare Tunnel:

```bash
# Parar o servico
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared

# Remover servico
sudo cloudflared service uninstall

# Deletar o tunnel
cloudflared tunnel delete godsend-cdn

# Desinstalar
sudo apt remove cloudflared -y

# Reconfigurar DNS para apontar direto para a VPS
# No Cloudflare Dashboard: DNS > Records
# Crie um registro A para cdn.speedygamesdownloads.com → IP da VPS
```

---

## Comparacao: Tunnel vs WARP vs DNS Proxy

| Recurso | Cloudflare Tunnel | Cloudflare WARP | DNS Proxy (nuvem laranja) |
|---------|-------------------|-----------------|---------------------------|
| Como funciona | Conexao segura VPS→Cloudflare | VPN na VPS | Proxy reverso via DNS |
| Custo | Gratuito (Argo: $5/mes+$0.10/GB) | Gratuito | Gratuito |
| Downloads grandes | Sem limite | Sem limite | Pode dar ban |
| Melhora rota cliente→VPS | Sim | Nao (muda rota VPS→internet) | Sim, mas com riscos |
| Compativel com HTTP | Sim (modo Flexible) | N/A | Sim (modo Flexible) |
| Riscos | Minimos | Problemas de rede residuais | Ban por uso excessivo |
| Recomendado para downloads | Sim | Nao (testes mostraram que nao ajuda) | Nao (foco em HTML) |
