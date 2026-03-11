# Instalacao do GODSend CMS em VPS Ubuntu Server

Guia completo para instalar o GODSend CMS em uma VPS limpa com Ubuntu Server (22.04 LTS ou 24.04 LTS).
Dominio usado neste guia: `stix.speedygamesdownloads.com`
CDN Proxy usado neste guia: `cdn.speedygamesdownloads.com`

Substitua `SEU_IP` pelo IP da sua VPS em todos os comandos.

---

## Requisitos

- VPS com Ubuntu Server 22.04 LTS ou 24.04 LTS
- Minimo 1 GB RAM, 1 vCPU
- Acesso root via SSH
- Dominio apontando para o IP da VPS (registro A no DNS)

**IMPORTANTE sobre velocidade de download**: A localizacao do datacenter da VPS afeta diretamente a velocidade de download para o Xbox 360. Se possivel, escolha uma VPS em um datacenter proximo dos seus usuarios. Exemplo: se seus usuarios estao no Brasil, uma VPS no Brasil tera melhor velocidade do que uma nos EUA (mesmo que a VPS nos EUA tenha mais banda total).

---

## Passo 1: Conectar na VPS via SSH

No seu computador, abra o terminal (ou PuTTY no Windows) e conecte:

```bash
ssh root@SEU_IP
```

Digite a senha que o provedor da VPS enviou por email.

## Passo 2: Atualizar o sistema

Atualize todos os pacotes do sistema:

```bash
apt update && apt upgrade -y
```

Isso pode demorar alguns minutos. Se perguntar algo, pressione Enter para aceitar o padrao.

## Passo 3: Verificar a velocidade da VPS

Antes de instalar tudo, verifique se a rede da VPS esta funcionando corretamente:

```bash
# Instalar speedtest
apt install -y speedtest-cli

# Testar velocidade
speedtest-cli
```

A velocidade de download deve ser alta (idealmente acima de 100 Mbps). Se estiver muito baixa (abaixo de 10 Mbps), considere trocar de provedor ou datacenter.

Teste tambem com download direto:

```bash
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2
```

Deve mostrar velocidade em MB/s. Anote esse valor para referencia futura.

## Passo 4: Criar usuario dedicado

Nunca rode o CMS como root. Crie um usuario dedicado:

```bash
adduser godsend
```

Vai pedir uma senha — escolha uma senha forte e anote. As outras perguntas (nome, telefone, etc.) pode deixar em branco, apenas pressione Enter.

De permissao de sudo ao usuario:

```bash
usermod -aG sudo godsend
```

## Passo 5: Instalar Node.js 20

Instale o Node.js 20 LTS via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verifique se instalou corretamente:

```bash
node -v
npm -v
```

Deve mostrar algo como `v20.x.x` e `10.x.x`.

Instale o PM2 (gerenciador de processos que mantem o CMS rodando):

```bash
npm install -g pm2
```

## Passo 6: Instalar MySQL

Instale o MySQL Server:

```bash
apt install -y mysql-server
```

Inicie e habilite o MySQL para iniciar automaticamente:

```bash
systemctl start mysql
systemctl enable mysql
```

Agora crie o banco de dados e o usuario. Entre no MySQL:

```bash
mysql
```

Dentro do MySQL, execute cada linha abaixo (uma de cada vez):

```sql
CREATE DATABASE godsend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'godsend_user'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON godsend.* TO 'godsend_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**IMPORTANTE**: Troque `SuaSenhaForte123!` por uma senha forte de sua escolha. Anote essa senha — voce vai precisar dela no Passo 10.

## Passo 7: Instalar nginx

```bash
apt install -y nginx
```

Verifique se esta rodando:

```bash
systemctl status nginx
```

Deve mostrar `active (running)`. Pressione `q` para sair.

## Passo 8: Configurar o Firewall (UFW)

O firewall protege sua VPS bloqueando portas desnecessarias:

```bash
ufw allow 22/tcp    # SSH (acesso remoto)
ufw allow 80/tcp    # HTTP (site)
ufw allow 443/tcp   # HTTPS (site com SSL)
ufw --force enable
```

Verifique:

```bash
ufw status
```

Deve mostrar as 3 portas liberadas.

## Passo 9: Subir os arquivos do CMS

Troque para o usuario godsend:

```bash
su - godsend
```

Crie a pasta do CMS:

```bash
mkdir -p ~/godsend-cms
```

Agora voce precisa copiar os arquivos do CMS para a VPS. Existem tres formas:

**Opcao A — Via SCP (do seu computador):**

Abra outro terminal no seu computador e execute:

```bash
scp -r ./* godsend@SEU_IP:~/godsend-cms/
```

**Opcao B — Via Git (se tiver repositorio):**

```bash
cd ~/godsend-cms
git clone SEU_REPOSITORIO .
```

**Opcao C — Via SFTP (FileZilla ou similar):**

Conecte com o usuario `godsend` e copie todos os arquivos para `/home/godsend/godsend-cms/`

Verifique se os arquivos estao la:

```bash
ls ~/godsend-cms/
```

Deve mostrar: `package.json`, `src/`, `index.js`, `.env.example`, `ecosystem.config.js`, etc.

## Passo 10: Configurar o arquivo .env

```bash
cd ~/godsend-cms
cp .env.example .env
nano .env
```

Preencha com os dados do seu banco de dados:

```
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=godsend
DB_USER=godsend_user
DB_PASS=SuaSenhaForte123!
PORT=5000
SESSION_SECRET=coloque-uma-string-aleatoria-longa-aqui-abc123xyz789
API_OPEN_ACCESS=false
FORCE_HTTPS=false
```

**Dicas:**
- `DB_PASS`: use a mesma senha que criou no Passo 6
- `SESSION_SECRET`: use qualquer texto longo e aleatorio (quanto mais longo melhor)
- `API_OPEN_ACCESS`: coloque `true` para testes iniciais, depois mude para `false`

Para salvar no nano: pressione `Ctrl+O`, depois `Enter`, depois `Ctrl+X`.

## Passo 11: Instalar dependencias do Node.js

```bash
cd ~/godsend-cms
npm install --production
```

Isso vai baixar todas as bibliotecas necessarias. Pode demorar 1-2 minutos.

## Passo 12: Testar se funciona

Teste manualmente antes de configurar tudo:

```bash
cd ~/godsend-cms
node src/app.js
```

Deve mostrar:
```
[GODSend] Server running on http://0.0.0.0:5000
```

Se mostrar erro de banco de dados, verifique os dados no `.env` (Passo 10).

Se funcionou, pressione `Ctrl+C` para parar.

## Passo 13: Configurar PM2 (manter o CMS rodando)

Crie a pasta de logs:

```bash
mkdir -p ~/godsend-cms/logs
```

Inicie o CMS com PM2:

```bash
cd ~/godsend-cms
pm2 start ecosystem.config.js
```

Verifique se esta rodando:

```bash
pm2 status
```

Deve mostrar `godsend` com status `online`.

Configure o PM2 para iniciar automaticamente quando a VPS reiniciar:

```bash
pm2 save
pm2 startup
```

O comando `pm2 startup` vai mostrar um comando que comeca com `sudo env PATH=...`. Copie esse comando completo e execute. Exemplo:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u godsend --hp /home/godsend
```

Depois execute novamente:

```bash
pm2 save
```

## Passo 14: Configurar nginx como Proxy Reverso

Volte para o usuario root:

```bash
exit
```

Crie o arquivo de configuracao do nginx:

```bash
nano /etc/nginx/sites-available/godsend
```

Cole o seguinte conteudo (pode colar tudo de uma vez):

```nginx
server {
    listen 80;
    server_name stix.speedygamesdownloads.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
        proxy_connect_timeout 30;
        send_timeout 3600;

        client_max_body_size 50m;
    }
}
```

Salve: `Ctrl+O`, `Enter`, `Ctrl+X`.

Ative o site e desative o site padrao:

```bash
ln -s /etc/nginx/sites-available/godsend /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
```

Teste se a configuracao esta correta:

```bash
nginx -t
```

Deve mostrar `syntax is ok` e `test is successful`.

Reinicie o nginx:

```bash
systemctl reload nginx
```

## Passo 15: Configurar CDN Proxy (Xbox/Console)

O Xbox 360 nao suporta HTTPS. O Pydio Cells/Quotaless forca HTTPS. Para resolver isso, configure um proxy reverso HTTP→HTTPS no nginx que o Xbox usa para baixar arquivos.

### 15.1: Criar registro DNS para o CDN

No painel do seu provedor de dominio, crie um registro A:
- **Nome/Host**: `cdn`
- **Tipo**: A
- **Valor/IP**: `SEU_IP` (mesmo IP da VPS)
- **TTL**: 3600

### 15.2: Criar configuracao nginx para CDN

```bash
nano /etc/nginx/sites-available/godsend-cdn
```

Cole o seguinte conteudo:

```nginx
server {
    listen 80;
    server_name cdn.speedygamesdownloads.com;

    location / {
        proxy_pass https://drive.quotaless.cloud;
        proxy_http_version 1.1;
        proxy_set_header Host drive.quotaless.cloud;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_ssl_server_name on;
        proxy_ssl_protocols TLSv1.2 TLSv1.3;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_read_timeout 3600;
        proxy_send_timeout 3600;
        proxy_connect_timeout 30;
        send_timeout 3600;

        proxy_max_temp_file_size 0;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;

        client_max_body_size 0;
    }
}
```

**IMPORTANTE**: Substitua `drive.quotaless.cloud` pelo dominio do seu servidor Pydio Cells se for diferente.

Salve e ative:

```bash
ln -s /etc/nginx/sites-available/godsend-cdn /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 15.3: Configurar CDN Proxy no CMS

No painel GODSend: **Configuracoes > Pydio Cells**

1. Preencha URL Base, Usuario, Senha e Workspace do Pydio
2. Clique "Testar Conexao" para verificar
3. Em **CDN Proxy URL**, coloque: `http://cdn.speedygamesdownloads.com`
4. Clique "Salvar"

Agora os downloads do Xbox usarao o CDN Proxy (HTTP) em vez de acessar o Quotaless diretamente (HTTPS).

### 15.4: Testar o CDN Proxy

```bash
# Verificar se o nginx responde no dominio CDN
curl -I http://cdn.speedygamesdownloads.com
```

Deve retornar HTTP 200 ou 3xx. Se retornar erro, verifique se o DNS ja propagou e se o nginx esta configurado corretamente.

## Passo 16: Apontar o dominio principal

No painel do seu provedor de dominio (onde registrou speedygamesdownloads.com), configure o DNS:

1. Crie um registro **A**:
   - **Nome/Host**: `stix`
   - **Tipo**: A
   - **Valor/IP**: `SEU_IP` (o IP da VPS)
   - **TTL**: 3600 (ou padrao)

A propagacao do DNS pode demorar de 5 minutos a 24 horas. Para verificar se ja propagou:

```bash
ping stix.speedygamesdownloads.com
```

Se resolver para o IP da VPS, esta pronto.

## Passo 17: SSL com Let's Encrypt (Opcional)

**AVISO IMPORTANTE**: O plugin Aurora do Xbox 360 NAO suporta HTTPS. Se seus usuarios usam o plugin, o site PRECISA continuar acessivel via HTTP (porta 80). O certbot vai perguntar se quer redirecionar HTTP para HTTPS — voce DEVE escolher NAO redirecionar. Assim o site fica acessivel tanto por HTTP (para o plugin Xbox) quanto por HTTPS (para navegadores).

**NAO instale SSL no dominio CDN** (`cdn.speedygamesdownloads.com`) — ele precisa ser HTTP puro para o Xbox.

Instale o Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Gere o certificado apenas para o dominio principal:

```bash
certbot --nginx -d stix.speedygamesdownloads.com
```

Vai pedir seu email e aceitar os termos. Quando perguntar sobre redirecionar HTTP para HTTPS, **escolha NAO redirecionar** (opcao 1) para manter o HTTP funcionando para o plugin Xbox.

O certificado renova automaticamente. Para testar a renovacao:

```bash
certbot renew --dry-run
```

**IMPORTANTE**: Mantenha `FORCE_HTTPS=false` no arquivo `.env` mesmo com SSL ativo. Essa opcao controla se o CMS redireciona HTTP para HTTPS — como o plugin Xbox precisa de HTTP, deve ficar desativada. O SSL funciona normalmente para quem acessar via HTTPS no navegador.

## Passo 18: Configurar o Plugin Xbox

No painel GODSend: **Configuracoes > Pydio Cells**, verifique que tudo esta configurado:

- [x] URL Base do Pydio preenchida
- [x] Usuario e Senha do Pydio
- [x] Workspace configurado
- [x] CDN Proxy URL preenchida (`http://cdn.speedygamesdownloads.com`)
- [x] Conexao testada com sucesso

No Xbox, o plugin GODSend usa o arquivo `GODSend.ini` para saber qual servidor acessar:

```ini
[Settings]
ServerUrl=http://stix.speedygamesdownloads.com
```

O plugin baixa automaticamente do servidor configurado. Os downloads usam a CDN Proxy URL para buscar os arquivos via HTTP.

## Passo 19: Verificacao Final

Acesse no navegador:

```
http://stix.speedygamesdownloads.com
```

Deve aparecer a tela de login ou o wizard de instalacao do GODSend.

Credenciais padrao:
- **Usuario**: admin
- **Password**: admin123

**Checklist:**
- [ ] Site abre no navegador
- [ ] Consegue fazer login
- [ ] Pydio Cells configurado e testado (Configuracoes > Pydio Cells)
- [ ] CDN Proxy URL configurada
- [ ] WordPress configurado (Configuracoes > WordPress) — se usar
- [ ] Jogos aparecem na lista
- [ ] Download funciona pelo navegador
- [ ] Download funciona pelo plugin Xbox
- [ ] Velocidade de download no Xbox esta aceitavel

### Teste de velocidade do Xbox

Apos configurar tudo, teste a velocidade de download no Xbox:

1. Abra o plugin GODSend no Xbox
2. Va em Configuracoes > Speed Test
3. Execute o teste de velocidade
4. A velocidade deve ser similar a do speed test da VPS (proporcional a banda)

Se a velocidade estiver muito baixa (abaixo de 500 KB/s), veja a secao "Download Lento" em Solucao de Problemas.

---

## Comandos Uteis

```bash
# Ver status do CMS
su - godsend -c "pm2 status"

# Ver logs do CMS em tempo real
su - godsend -c "pm2 logs godsend"

# Ver ultimas 50 linhas de log
su - godsend -c "pm2 logs godsend --lines 50"

# Reiniciar o CMS
su - godsend -c "pm2 restart godsend"

# Parar o CMS
su - godsend -c "pm2 stop godsend"

# Reiniciar nginx
systemctl reload nginx

# Ver logs do nginx
tail -50 /var/log/nginx/error.log
tail -50 /var/log/nginx/access.log

# Testar velocidade da VPS
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2

# Testar velocidade da VPS (Ookla)
speedtest-cli

# Ver uso de disco
df -h

# Ver uso de memoria
free -h

# Ver processos rodando
htop
```

## Atualizando o CMS

Quando tiver uma nova versao do CMS:

```bash
su - godsend
cd ~/godsend-cms

# Se usar Git:
git pull

# Se usar SCP, substitua os arquivos e depois:
npm install --production
pm2 restart godsend
```

---

## Cloudflare WARP (Opcional)

O Cloudflare WARP e uma VPN gratuita que pode melhorar a velocidade de download em alguns casos, roteando o trafego pela rede otimizada do Cloudflare.

**Quando usar:** Se a velocidade de download no Xbox estiver baixa apesar da VPS ter boa banda, o WARP pode melhorar o roteamento.

**Quando NAO usar:** Se a velocidade ja esta boa, nao instale o WARP — ele pode causar problemas de rede residuais que persistem mesmo apos desconectar.

Para instrucoes completas de instalacao e configuracao do WARP, veja o arquivo `CLOUDFLARE_WARP.md`.

**AVISO**: Em nossos testes, o WARP em modo full tunnel pode interferir com conexoes de entrada e causar problemas de velocidade residuais mesmo apos ser desconectado. Se isso acontecer, desinstale completamente o WARP e reinicie a VPS (ou resete a maquina). Veja a secao "Desinstalar WARP com Seguranca" no guia CLOUDFLARE_WARP.md.

---

## Seguranca Extra (Recomendado)

### Desativar login root via SSH

```bash
nano /etc/ssh/sshd_config
```

Encontre a linha `PermitRootLogin yes` e mude para:

```
PermitRootLogin no
```

Salve e reinicie o SSH:

```bash
systemctl restart sshd
```

**IMPORTANTE**: Antes de fazer isso, certifique-se de que consegue acessar via `ssh godsend@SEU_IP` e que o usuario godsend tem sudo.

### Instalar Fail2Ban (protecao contra ataques de forca bruta)

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

O Fail2Ban automaticamente bloqueia IPs que tentam adivinhar sua senha SSH.

---

## Solucao de Problemas

### Site nao abre (ERR_CONNECTION_REFUSED)
1. Verifique se o nginx esta rodando: `systemctl status nginx`
2. Verifique se o firewall permite porta 80: `ufw status`
3. Verifique se o DNS aponta para o IP correto: `ping stix.speedygamesdownloads.com`

### Erro 502 Bad Gateway
O Node.js nao esta rodando. Verifique:
```bash
su - godsend -c "pm2 status"
su - godsend -c "pm2 logs godsend --lines 30"
```

Se o status for `errored`, veja os logs para entender o erro. Problemas comuns:
- Banco de dados nao esta rodando: `systemctl status mysql`
- Dados do `.env` incorretos (senha do banco, nome do banco)
- Porta 5000 ja em uso: `ss -tlnp | grep 5000`

### Erro de conexao com banco de dados
```bash
# Verificar se o MySQL esta rodando
systemctl status mysql

# Testar conexao manual
mysql -u godsend_user -p godsend
# Digite a senha quando pedir
# Se conectar, digite EXIT; para sair
```

Se nao conectar, recrie o usuario (como root):
```bash
mysql
DROP USER 'godsend_user'@'localhost';
CREATE USER 'godsend_user'@'localhost' IDENTIFIED BY 'SuaSenhaForte123!';
GRANT ALL PRIVILEGES ON godsend.* TO 'godsend_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### PM2 nao inicia no boot
```bash
su - godsend
pm2 save
pm2 startup
# Execute o comando que ele mostrar
pm2 save
```

### Permissoes de arquivo
```bash
# Garantir que o usuario godsend e dono dos arquivos
sudo chown -R godsend:godsend /home/godsend/godsend-cms/

# Garantir permissao de escrita na pasta de uploads
chmod -R 755 /home/godsend/godsend-cms/src/public/uploads/
```

### Download lento no Xbox

Se os downloads do Xbox estiverem lentos (abaixo de 500 KB/s), siga estes passos:

**1. Verifique a velocidade da VPS:**
```bash
wget -O /dev/null http://speedtest.tele2.net/100MB.zip 2>&1 | tail -2
```
Se a velocidade for baixa (abaixo de 10 MB/s), o problema e a rede da VPS.

**2. Verifique a velocidade VPS→Quotaless:**
```bash
curl -o /dev/null -w "Velocidade: %{speed_download} bytes/s\n" "URL_DE_DOWNLOAD_DO_PYDIO"
```
Se a velocidade for alta (acima de 10 MB/s), o problema e a rota VPS→Xbox.

**3. Verifique se o WARP esta instalado:**
O Cloudflare WARP pode causar problemas de rede residuais. Se o WARP esta instalado mas nao esta sendo usado ativamente, desinstale-o completamente:
```bash
warp-cli disconnect
warp-cli registration delete
sudo apt remove cloudflare-warp -y
sudo reboot
```
Teste a velocidade novamente apos o reboot.

**4. Use Cloudflare Tunnel (RECOMENDADO):**
O Cloudflare Tunnel faz o Xbox se conectar ao servidor Cloudflare **mais proximo do Xbox** (ex: no Brasil) em vez de conectar direto na VPS (Dallas). Isso melhora significativamente a velocidade.

Siga o guia completo em `CLOUDFLARE_TUNNEL.md` para configurar.

**5. Considere a localizacao do datacenter:**
A distancia entre a VPS e o Xbox afeta a velocidade. Testes mostraram:
- VPS no mesmo pais que o Xbox: ~1.6 MB/s
- VPS em outro continente: ~300 KB/s

Se possivel, escolha uma VPS em um datacenter proximo dos seus usuarios. Alternativamente, use Cloudflare Tunnel para otimizar a rota sem trocar de VPS.

**6. Xbox em WiFi vs cabo:**
O Xbox 360 em WiFi pode ter velocidade limitada. Se possivel, use cabo ethernet.

### CDN Proxy nao funciona (Xbox nao baixa)
1. Verifique se o DNS do CDN propagou: `ping cdn.speedygamesdownloads.com`
2. Verifique se o nginx CDN esta rodando: `nginx -t && systemctl status nginx`
3. Teste o CDN manualmente: `curl -I http://cdn.speedygamesdownloads.com`
4. Verifique os logs do nginx: `tail -20 /var/log/nginx/error.log`
5. Verifique se o Pydio Cells esta acessivel da VPS:
```bash
curl -I https://drive.quotaless.cloud
```
