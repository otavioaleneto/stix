# Cloudflare WARP - Guia de Instalacao na VPS

O Cloudflare WARP e uma VPN gratuita que roteia o trafego da VPS pela rede otimizada do Cloudflare.
Pode melhorar a velocidade de download em cenarios onde a rota de rede entre a VPS e o Xbox e ruim.

## AVISOS IMPORTANTES

**Antes de instalar, leia com atencao:**

1. **O WARP pode causar problemas de rede residuais** que persistem mesmo apos desconectar. Em nossos testes, uma VPS que tinha WARP instalado ficou com velocidade de download degradada (469 KB/s vs 744 Mbps apos reset). Se isso acontecer, desinstale completamente e reinicie a VPS.

2. **O modo Full Tunnel pode bloquear conexoes de entrada**, impedindo que o Xbox se conecte ao nginx CDN Proxy. Se isso acontecer, mude para modo Proxy SOCKS5.

3. **Teste a velocidade da VPS ANTES de instalar** e anote os valores. Assim voce pode comparar depois e detectar degradacao.

4. **Nem sempre o WARP melhora a velocidade.** Se o gargalo e a distancia geografica entre a VPS e o Xbox (ex: VPS nos EUA, Xbox no Brasil), o WARP pode nao ajudar. Considere trocar para uma VPS mais proxima dos seus usuarios.

## Quando usar WARP?

- A VPS tem boa banda (acima de 100 Mbps) mas o Xbox baixa lento (abaixo de 500 KB/s)
- Voce quer tentar melhorar o roteamento sem trocar de VPS
- Voce quer usar o modo Proxy SOCKS5 para que o CMS faca streaming de downloads pela rede Cloudflare

## Quando NAO usar WARP?

- A velocidade ja esta aceitavel
- A VPS ja esta proxima dos usuarios (mesmo pais/regiao)
- Voce nao quer correr risco de problemas de rede residuais

---

## Modos de Operacao

### Modo 1: Proxy SOCKS5 (Recomendado)

Apenas aplicacoes configuradas usam o WARP via proxy SOCKS5 (porta 40000).
O CMS usa este modo para fazer streaming de downloads via WARP quando nao ha CDN Proxy configurado.

- Mais seguro: nao afeta o sistema inteiro
- Nao interfere com conexoes de entrada (SSH, nginx, etc.)
- Desvantagem: apenas o CMS usa o WARP (nginx CDN Proxy nao usa)

### Modo 2: Full Tunnel (Experimental)

Todo o trafego da VPS passa pelo Cloudflare.

- **AVISO**: Pode bloquear conexoes de entrada e causar problemas
- **AVISO**: Pode deixar configuracoes residuais de rede mesmo apos desconectar
- Vantagem teorica: todo trafego (incluindo nginx) usa a rede Cloudflare
- Na pratica: em nossos testes, nao melhorou a velocidade do Xbox e causou problemas

---

## Verificacao Pre-Instalacao

Antes de instalar, anote a velocidade atual da VPS:

```bash
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2
speedtest-cli 2>/dev/null || echo "speedtest-cli nao instalado"
```

Guarde esses numeros para comparar depois.

---

## Instalacao (Ubuntu Server 22.04 / 24.04)

### 1. Adicionar repositorio do Cloudflare

```bash
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list
```

### 2. Instalar o WARP

```bash
sudo apt update
sudo apt install -y cloudflare-warp
```

### 3. Registrar o WARP

```bash
warp-cli registration new
```

Aceite os termos de servico quando solicitado.

### 4. Verificar status

```bash
warp-cli status
```

Deve mostrar `Status: Disconnected` (ainda nao conectado).

---

## Configuracao - Modo Proxy SOCKS5 (Recomendado)

### 1. Definir modo proxy

```bash
warp-cli mode proxy
```

### 2. Configurar porta

```bash
warp-cli proxy port 40000
```

### 3. Conectar

```bash
warp-cli connect
```

### 4. Verificar

```bash
# Verificar status
warp-cli status
# Deve mostrar: Status update: Connected

# Testar conexao via SOCKS5
curl -x socks5://127.0.0.1:40000 -s https://cloudflare.com/cdn-cgi/trace | grep -E "ip=|warp="
# Deve mostrar: warp=on (ou warp=plus)
```

### 5. Configurar no CMS

No painel GODSend: **Configuracoes > Pydio Cells > Cloudflare WARP**
- Marque "Ativar WARP Proxy"
- Porta SOCKS5: 40000
- Clique "Testar WARP" para verificar (deve mostrar verde com IP)
- Salve

Quando o WARP Proxy esta ativo e a CDN Proxy URL esta vazia, o CMS faz streaming dos downloads via WARP SOCKS5 automaticamente.

---

## Configuracao - Modo Full Tunnel (Experimental)

**AVISO**: Este modo pode causar problemas. Use apenas se o modo proxy nao for suficiente.

### 1. Proteger acesso SSH ANTES de conectar

**IMPORTANTE**: Antes de ativar o WARP, exclua seu IP de administracao para nao perder acesso SSH.

```bash
# Descubra seu IP publico (do computador que usa SSH)
# Acesse https://ifconfig.me no seu navegador

# Exclua seu IP da VPN (substitua pelo seu IP real)
warp-cli tunnel ip add SEU_IP
```

### 2. Definir modo full tunnel

```bash
warp-cli mode warp
```

### 3. Conectar

```bash
warp-cli connect
```

### 4. Verificar

```bash
# Verificar status
warp-cli status
# Deve mostrar: Status update: Connected

# Verificar se o IP mudou (deve ser IP do Cloudflare)
curl -s ifconfig.me
echo

# Verificar detalhes da conexao WARP
curl -s https://cloudflare.com/cdn-cgi/trace | grep -E "ip=|warp="
# Deve mostrar: warp=on (ou warp=plus)
```

### 5. Testar downloads

Teste se o Xbox consegue baixar. Se os downloads nao iniciarem ou ficarem travados em 0%, o modo full tunnel esta bloqueando conexoes de entrada. Mude para modo proxy:

```bash
warp-cli mode proxy
warp-cli proxy port 40000
warp-cli connect
```

---

## Auto-inicio no Boot

O servico `warp-svc` ja e instalado com systemd e inicia automaticamente:

```bash
# Verificar se esta habilitado
sudo systemctl status warp-svc

# Habilitar se necessario
sudo systemctl enable warp-svc
```

O WARP reconecta automaticamente apos reiniciar a VPS.

---

## Verificacao de Velocidade

Apos configurar o WARP, teste a velocidade:

### Teste pelo terminal da VPS

```bash
# Velocidade direto (sem WARP)
curl -o /dev/null -w "Velocidade: %{speed_download} bytes/s\n" "URL_DO_ARQUIVO"

# Velocidade via WARP (modo proxy)
curl -x socks5://127.0.0.1:40000 -o /dev/null -w "Velocidade: %{speed_download} bytes/s\n" "URL_DO_ARQUIVO"
```

### Teste pelo Xbox

Use o Speed Test no plugin GODSend (Configuracoes > Speed Test).
O speed test tambem suporta modo WARP: `/api/speedtest?size=10&via=warp`

---

## Troubleshooting

### Perdi acesso SSH apos ativar WARP

```bash
# Se ainda tiver acesso ao console da VPS (painel do provedor):
warp-cli disconnect

# Depois exclua seu IP
warp-cli tunnel ip add SEU_IP

# Reconecte
warp-cli connect
```

### WARP nao conecta

```bash
# Verificar logs
sudo journalctl -u warp-svc -n 50

# Re-registrar se necessario
warp-cli registration delete
warp-cli registration new
```

### Velocidade piorou apos instalar WARP

O WARP pode deixar configuracoes residuais de rede. Desinstale completamente:

```bash
warp-cli disconnect
warp-cli registration delete
sudo apt remove cloudflare-warp -y
sudo reboot
```

Apos o reboot, teste a velocidade novamente:
```bash
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2
```

Se a velocidade nao voltar ao normal, pode ser necessario resetar a VPS pelo painel do provedor.

### Downloads do Xbox nao iniciam (modo full tunnel)

O modo full tunnel pode interferir com conexoes de entrada. Mude para modo proxy:

```bash
warp-cli mode proxy
warp-cli proxy port 40000
warp-cli connect
```

### nginx CDN Proxy com WARP Modo Proxy

O nginx nao suporta SOCKS5 nativamente. Neste caso, o CMS pode fazer o streaming via WARP SOCKS5 como alternativa ao nginx CDN proxy.
Configure no CMS: ative WARP Proxy e deixe CDN Proxy URL vazio.

---

## Desinstalar WARP com Seguranca

Se decidir remover o WARP, faca uma desinstalacao completa para evitar problemas residuais:

```bash
# 1. Desconectar
warp-cli disconnect

# 2. Remover registro
warp-cli registration delete

# 3. Desinstalar pacote
sudo apt remove cloudflare-warp -y
sudo apt autoremove -y

# 4. Limpar configuracoes residuais
sudo rm -rf /var/lib/cloudflare-warp
sudo rm -f /etc/apt/sources.list.d/cloudflare-client.list
sudo rm -f /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg

# 5. Reiniciar para limpar qualquer configuracao de rede residual
sudo reboot
```

Apos o reboot, verifique que a velocidade voltou ao normal:
```bash
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2
```
