// 🚨 Mantenha sua chave de API segura.
// A chave do OpenWeatherMap fica aqui no frontend (aceitável para portfólio).
// A chave do Google Gemini fica ESCONDIDA no backend (api/chat.js).
const apiKey = "0c8d875a528d7f6533218196609eb07b";

let mapa;
let graficoTemp = null;
// Variável para controlar os tempos do robô para não encavalar falas
let botTimers = [];

document.addEventListener("DOMContentLoaded", () => {
  mostrarHistorico();
  inicializarMapa();
});

// --- Geolocalização ---
function usarMinhaLocalizacao() {
  if (!navigator.geolocation) {
    Swal.fire("Erro", "Seu navegador não suporta geolocalização.", "error");
    return;
  }
  Swal.fire({
    title: "Localizando...",
    text: "Aguarde um momento.",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    background: "#fff",
    color: "#333",
  });
  navigator.geolocation.getCurrentPosition(
    (pos) =>
      buscarClimaPorCoord(
        {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: "Sua Localização",
        },
        true
      ),
    () => Swal.fire("Ops!", "Não conseguimos obter sua localização.", "warning")
  );
}

// --- Busca e Sugestões ---
let timeoutBusca = null;
function buscarSugestoes() {
  clearTimeout(timeoutBusca);
  const cidade = document.getElementById("cidade").value;
  const div = document.getElementById("sugestoes");

  if (cidade.length < 3) {
    div.innerHTML = "";
    return;
  }

  timeoutBusca = setTimeout(async () => {
    try {
      const resp = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          cidade
        )}&limit=5&appid=${apiKey}`
      );
      const dados = await resp.json();
      div.innerHTML = "";
      dados.forEach((lugar) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        const pais = lugar.country
          ? `<img src="https://flagcdn.com/16x12/${lugar.country.toLowerCase()}.png" class="me-2">`
          : "";
        btn.innerHTML = `${pais}${lugar.name}, ${lugar.state || ""}`;
        btn.onclick = () => {
          document.getElementById("cidade").value = lugar.name;
          div.innerHTML = "";
          buscarClimaPorCoord(lugar);
        };
        div.appendChild(btn);
      });
    } catch (e) {
      console.error(e);
    }
  }, 500);
}

function iniciarBusca() {
  const termo = document.getElementById("cidade").value;
  if (termo) buscarSugestoes();
}

// --- Lógica Principal do Clima ---
async function buscarClimaPorCoord(lugar, isGeo = false) {
  if (isGeo) Swal.close();
  const { lat, lon } = lugar;

  try {
    const [resW, resF] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&lang=pt_br&units=metric`
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&lang=pt_br&units=metric`
      ),
    ]);

    if (!resW.ok || !resF.ok) throw new Error("Erro API");
    const dadosW = await resW.json();
    const dadosF = await resF.json();

    atualizarInterface(dadosW, lugar.name || dadosW.name);
    renderizarPrevisao(dadosF.list);
    renderizarGrafico(dadosF.list);
    atualizarMapa(lat, lon);
    atualizarFundo(dadosW.weather[0].id, dadosW.weather[0].icon);
    salvarHistorico(lugar.name || dadosW.name);

    // 🔥 INTEGRAÇÃO SKYBOT COM ANIMAÇÃO 🔥
    // Chama a função que faz o robô abrir, falar e fechar
    triggerBotCuriosidade(lugar.name || dadosW.name);

    document.getElementById("empty-state").classList.add("oculto");
    document.getElementById("conteudo-principal").classList.remove("oculto");
  } catch (e) {
    console.error(e);
    Swal.fire("Erro", "Falha ao carregar dados.", "error");
  }
}

function atualizarInterface(dados, nome) {
  document.getElementById("nome-cidade").textContent = nome;
  document.getElementById("data-atual").textContent =
    new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  document.getElementById("temperatura").textContent = Math.round(
    dados.main.temp
  );
  document.getElementById("descricao").textContent =
    dados.weather[0].description;
  document.getElementById(
    "icone"
  ).src = `https://openweathermap.org/img/wn/${dados.weather[0].icon}@4x.png`;

  document.getElementById(
    "sensacao"
  ).textContent = `${dados.main.feels_like.toFixed(1)}°C`;
  document.getElementById("umidade").textContent = `${dados.main.humidity}%`;
  document.getElementById("vento").textContent = `${(
    dados.wind.speed * 3.6
  ).toFixed(1)} km/h`;
  document.getElementById("visibilidade").textContent = `${(
    dados.visibility / 1000
  ).toFixed(1)} km`;
}

function renderizarPrevisao(lista) {
  const div = document.getElementById("cards-previsao");
  div.innerHTML = "";
  lista.slice(0, 8).forEach((item) => {
    const hora = new Date(item.dt * 1000).getHours() + "h";
    const card = document.createElement("div");
    card.className = "previsao-card";
    card.innerHTML = `<small class="d-block mb-1 fw-bold">${hora}</small>
                          <img src="https://openweathermap.org/img/wn/${
                            item.weather[0].icon
                          }.png" width="40">
                          <div class="fw-bold">${Math.round(
                            item.main.temp
                          )}°</div>`;
    div.appendChild(card);
  });
}

// --- Gráfico Chart.js ---
function renderizarGrafico(lista) {
  const ctx = document.getElementById("tempChart").getContext("2d");
  const dados = lista.slice(0, 8);
  const labels = dados.map((i) => new Date(i.dt * 1000).getHours() + "h");
  const temps = dados.map((i) => i.main.temp);

  if (graficoTemp) graficoTemp.destroy();

  graficoTemp = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Temp",
          data: temps,
          borderColor: "#ffffff",
          borderWidth: 2,
          tension: 0.4,
          pointBackgroundColor: "#fff",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: "rgba(255,255,255,0.7)" },
          grid: { display: false },
        },
        y: { display: false },
      },
    },
  });
}

// --- Mapa e Utilitários ---
function inicializarMapa() {
  mapa = L.map("mapa", { zoomControl: false }).setView([-14.235, -51.925], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(mapa);
}

function atualizarMapa(lat, lon) {
  const el = document.getElementById("mapa");
  el.classList.add("visivel");
  setTimeout(() => {
    mapa.invalidateSize();
    mapa.setView([lat, lon], 12);
    mapa.eachLayer((l) => l instanceof L.Marker && mapa.removeLayer(l));
    L.marker([lat, lon]).addTo(mapa);
  }, 200);
}

function atualizarFundo(id, icon) {
  const b = document.body;
  b.className = "";
  if (icon.endsWith("n")) b.classList.add("weather-night");
  else if (id >= 200 && id < 600) b.classList.add("weather-rain");
  else if (id > 800) b.classList.add("weather-clouds");
  else if (id === 800) b.classList.add("weather-sunny");
  else b.classList.add("weather-default");
}

function salvarHistorico(cidade) {
  let h = JSON.parse(localStorage.getItem("historico")) || [];
  h = h.filter((c) => c !== cidade);
  h.unshift(cidade);
  localStorage.setItem("historico", JSON.stringify(h.slice(0, 5)));
  mostrarHistorico();
}

function mostrarHistorico() {
  const div = document.getElementById("historico");
  const h = JSON.parse(localStorage.getItem("historico")) || [];
  div.innerHTML = "";
  h.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-light rounded-pill";
    btn.textContent = c;
    btn.onclick = () => {
      document.getElementById("cidade").value = c;
      iniciarBusca();
    };
    div.appendChild(btn);
  });
}

function lerConteudo() {
  if (
    document.getElementById("conteudo-principal").classList.contains("oculto")
  )
    return;
  const msg = `Em ${document.getElementById("nome-cidade").textContent}, faz ${
    document.getElementById("temperatura").textContent
  } graus com ${document.getElementById("descricao").textContent}.`;
  const u = new SpeechSynthesisUtterance(msg);
  u.lang = "pt-BR";
  window.speechSynthesis.speak(u);
}

// ==========================================================
// --- SKYBOT INTELLIGENT (Conexão Vercel + Animação) ---
// ==========================================================

function toggleChat() {
  const chat = document.getElementById("skybot-container");
  chat.classList.toggle("skybot-open");
  chat.classList.toggle("skybot-closed");
  if (chat.classList.contains("skybot-open")) {
    document.getElementById("user-input").focus();
  }
}

// Função auxiliar para limpar os timers se a pessoa pesquisar rápido
function clearBotTimers() {
  botTimers.forEach((timer) => clearTimeout(timer));
  botTimers = [];
}

// 1. O COMPORTAMENTO "VIVO" (Abre -> Fala -> Fecha -> Abre)
async function triggerBotCuriosidade(nomeCidade) {
  const chat = document.getElementById("skybot-container");

  // Reseta timers antigos para não encavalar animação
  clearBotTimers();

  // Fecha o chat inicialmente (se estiver aberto) para dar efeito de novidade
  if (chat.classList.contains("skybot-open")) {
    toggleChat();
  }

  try {
    // Busca a curiosidade no Backend da Vercel
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: nomeCidade,
        contexto: "curiosidade",
      }),
    });

    const data = await response.json();

    if (!data.reply) return; // Se der erro na IA, não faz nada

    // --- SEQUÊNCIA DE ANIMAÇÃO DO ROBÔ ---

    //

    // 1. Espera 2 segundos, abre o chat e mostra a curiosidade
    botTimers.push(
      setTimeout(() => {
        if (chat.classList.contains("skybot-closed")) toggleChat(); // Abre
        addMessage(
          `💡 <strong>Curiosidade sobre ${nomeCidade}:</strong> ${data.reply}`,
          "bot"
        );
      }, 2000)
    );

    // 2. Espera +12 segundos (tempo de ler), e FECHA o balão
    botTimers.push(
      setTimeout(() => {
        if (chat.classList.contains("skybot-open")) toggleChat(); // Fecha
      }, 14000)
    );

    // 3. Espera +5 segundos com ele fechado, e ABRE oferecendo ajuda
    botTimers.push(
      setTimeout(() => {
        if (chat.classList.contains("skybot-closed")) toggleChat(); // Abre de novo
        addMessage(
          `🤔 Ficou com alguma dúvida sobre o clima de <strong>${nomeCidade}</strong>? Pode me perguntar!`,
          "bot"
        );
      }, 19000)
    );
  } catch (error) {
    console.error("Erro no bot:", error);
  }
}

// 2. Função para conversa livre (Enter no input)
function handleEnter(event) {
  if (event.key === "Enter") sendMessage();
}

// 3. Enviar mensagem do usuário
async function sendMessage() {
  const input = document.getElementById("user-input");
  const texto = input.value.trim();
  if (!texto) return;

  // Se o usuário interagiu, paramos as animações automáticas para não atrapalhar
  clearBotTimers();

  addMessage(texto, "user");
  input.value = "";

  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mensagem: texto,
        contexto: "chat",
      }),
    });

    const data = await response.json();
    removeTyping();
    addMessage(data.reply || "Desculpe, não entendi.", "bot");
  } catch (error) {
    removeTyping();
    addMessage("Estou com problemas de conexão com o satélite... 🛰️", "bot");
  }
}

// Utilitários de UI do Chat
function addMessage(html, type) {
  const chatBody = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `message ${type === "bot" ? "bot-msg" : "user-msg"}`;
  div.innerHTML = html;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function showTyping() {
  const chatBody = document.getElementById("chat-messages");
  if (document.getElementById("bot-typing")) return;

  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message bot-msg text-muted fst-italic";
  loadingDiv.id = "bot-typing";
  loadingDiv.innerHTML =
    '<i class="fas fa-circle-notch fa-spin me-2"></i>Consultando IA...';
  chatBody.appendChild(loadingDiv);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function removeTyping() {
  const loading = document.getElementById("bot-typing");
  if (loading) loading.remove();
}
