scriptTitle = "GODSend Speed Test";
scriptAuthor = "GODSend Team";
scriptVersion = 1;
scriptDescription = "Check your Download Speed from GODSend servers";
scriptIcon = "icon\\icon.xur";
scriptPermissions = { "http", "filesystem" };

require("AuroraUI");
require("helper\\helper");

local downloadPath = "data\\downloadData.data";

local servers = {};
servers[1] = { name = "VPS Direto (GODSend)",       url = "http://stix.speedygamesdownloads.com/api/speedtest?size=10" };
servers[2] = { name = "CDN Proxy (GODSend)",         url = "http://cdn.speedygamesdownloads.com/api/speedtest?size=10" };
servers[3] = { name = "Servidor Externo (AVM 50MB)", url = "http://scope.avm.de/zackAVM2015_Test/50MB.data" };

function main()
  if not isInitSuccessful() then
    return;
  end

  local selection = Script.ShowMessageBox("GODSend Speed Test",
    "Este script vai baixar arquivos de teste para medir\n" ..
    "a velocidade de download de diferentes servidores.\n\n" ..
    "Para resultados confiaveis, pare outros downloads.\n\n" ..
    "Selecione o servidor na proxima tela.",
    "Continuar",
    "Cancelar");

  if selection.Button ~= 1 then
    return;
  end

  local running = true;
  while running do
    local items = {};
    for i = 1, #servers do
      items[i] = servers[i].name;
    end
    items[#servers + 1] = "Testar TODOS";
    items[#servers + 2] = "Sair";

    local ret = Script.ShowPopupList("GODSend Speed Test", "Selecione o servidor:", items);

    if ret.Canceled then
      running = false;
    else
      local idx = ret.Selected.Index;

      if idx == #servers + 1 then
        running = false;
      elseif idx == #servers then
        runAllTests();
      else
        local srv = servers[idx + 1];
        if srv then
          local speed = runSingleTest(srv.name, srv.url, 2);
          showSingleResult(srv.name, speed);
        end
      end
    end
  end

  Script.SetStatus("Concluido");
  Script.SetProgress(100);
end

function isInitSuccessful()
  Script.SetStatus("Inicializando...");
  Script.SetProgress(10);

  Script.SetStatus("Limpando dados...");
  FileSystem.DeleteFile(Script.GetBasePath() .. downloadPath);

  Script.SetStatus("Verificando conexao...");
  if not Aurora.HasInternetConnection() then
    Script.ShowMessageBox("Erro", "Sem conexao com a Internet!", "Fechar");
    return false;
  end

  Script.SetProgress(20);
  return true;
end

function runSingleTest(label, url, count)
  Script.SetStatus("Testando: " .. label);
  Script.SetProgress(30);

  local downstreamTimes = {};
  local downloadFileSize = 0;

  for i = 1, count do
    Script.SetStatus("Download " .. i .. "/" .. count .. ": " .. label);
    Script.SetProgress(30 + math.floor((i / count) * 50));

    FileSystem.DeleteFile(Script.GetBasePath() .. downloadPath);

    local timeSnap = getCurrentTimeInMilliseconds();
    local httpData = Http.Get(url, downloadPath);

    if httpData.Success then
      local elapsedTime = (getCurrentTimeInMilliseconds() - timeSnap) / 1000;
      if elapsedTime <= 0 then elapsedTime = 0.001; end
      downloadFileSize = FileSystem.GetFileSize(Script.GetBasePath() .. downloadPath);
      downstreamTimes[#downstreamTimes + 1] = elapsedTime;
    end
  end

  Script.SetProgress(90);

  if #downstreamTimes == 0 then
    return 0;
  end

  table.sort(downstreamTimes);
  return downloadFileSize / downstreamTimes[1];
end

function showSingleResult(label, speedBPS)
  if speedBPS <= 0 then
    Script.ShowMessageBox("Resultado: " .. label,
      "Download FALHOU!\n\nO servidor pode estar offline\nou inacessivel.",
      "OK");
    return;
  end

  local mbit = round((speedBPS / 1024 / 1024 * 8), 3);
  local mbyte = round((speedBPS / 1024 / 1024), 3);

  Script.ShowMessageBox("Resultado: " .. label,
    "Download: " .. tostring(mbit) .. " Mbit/s\n" ..
    "Download: " .. tostring(mbyte) .. " MByte/s\n",
    "OK");
end

function runAllTests()
  local results = {};

  for i = 1, #servers do
    local speed = runSingleTest(servers[i].name, servers[i].url, 2);
    results[i] = { name = servers[i].name, speed = speed };
  end

  local msg = "";
  for i = 1, #results do
    local mbit = round((results[i].speed / 1024 / 1024 * 8), 3);
    local mbyte = round((results[i].speed / 1024 / 1024), 3);
    if results[i].speed > 0 then
      msg = msg .. results[i].name .. ":\n";
      msg = msg .. "  " .. tostring(mbit) .. " Mbit/s (" .. tostring(mbyte) .. " MB/s)\n\n";
    else
      msg = msg .. results[i].name .. ":\n  FALHOU\n\n";
    end
  end

  Script.ShowMessageBox("Resultados Completos", msg, "OK");
end
