// 🚨 ATENÇÃO: PONTO CRÍTICO DE SEGURANÇA! 🚨
// A chave de API nunca deve ficar exposta no código do lado do cliente (frontend).
// Qualquer pessoa pode copiá-la e usar em seu nome.
// Para projetos reais, use um backend ou uma função serverless para proteger sua chave.
const apiKey = "0c8d875a528d7f6533218196609eb07b";

let coordenadasSelecionadas = null;
let mapa;

// CORREÇÃO: Usar addEventListener para não sobrescrever o script do VLibras.
window.addEventListener('DOMContentLoaded', (event) => {
    mostrarHistorico();
    inicializarMapa();
});

async function buscarSugestoes() {
    const cidade = document.getElementById("cidade").value;
    if (cidade.length < 3) {
        document.getElementById("sugestoes").innerHTML = "";
        return;
    }
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cidade)}&limit=5&appid=${apiKey}`;

    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();
        mostrarSugestoes(dados);
    } catch (erro) {
        console.error("Erro ao buscar sugestões:", erro);
        alert("Não foi possível buscar as sugestões de cidade. Verifique a conexão.");
    }
}

function mostrarSugestoes(locais) {
    const sugestoesDiv = document.getElementById("sugestoes");
    sugestoesDiv.innerHTML = "";

    if (locais.length === 0) {
        sugestoesDiv.innerHTML = "<p>Nenhum local encontrado.</p>";
        return;
    }

    locais.forEach((lugar) => {
        const botao = document.createElement("button");
        botao.className = "btn btn-outline-primary btn-sm m-1";
        botao.textContent = `${lugar.name}, ${lugar.state || ""}, ${lugar.country}`;
        botao.onclick = () => selecionarLocal(lugar);
        sugestoesDiv.appendChild(botao);
    });
}

function selecionarLocal(lugar) {
    coordenadasSelecionadas = { lat: lugar.lat, lon: lugar.lon };
    document.getElementById("sugestoes").innerHTML = ""; // Limpa as sugestões
    buscarClimaPorCoord(lugar);
    atualizarMapa(lugar.lat, lugar.lon);
}

async function buscarClimaPorCoord(lugar) {
    const { lat, lon, name, state, country } = lugar;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&lang=pt_br&units=metric`;

    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Falha na resposta da rede');
        const dados = await resposta.json();

        document.getElementById("nome-cidade").textContent = `${name}, ${state || country}`;
        document.getElementById("temperatura").textContent = `🌡️ Temperatura: ${dados.main.temp.toFixed(1)}°C`;
        document.getElementById("descricao").textContent = `🌦️ Clima: ${dados.weather[0].description}`;
        document.getElementById("icone").src = `https://openweathermap.org/img/wn/${dados.weather[0].icon}@2x.png`;
        document.getElementById("sensacao").textContent = `🤒 Sensação térmica: ${dados.main.feels_like.toFixed(1)}°C`;
        document.getElementById("umidade").textContent = `💧 Umidade: ${dados.main.humidity}%`;
        document.getElementById("vento").textContent = `💨 Vento: ${dados.wind.speed.toFixed(1)} km/h`;

        const figura = document.getElementById("figura-tempo");
        if (figura) {
            if (dados.main.temp <= 15) {
                figura.src = "imagens/inverno.svg";
                figura.alt = "Ilustração de tempo frio";
            } else if (dados.main.temp >= 30) {
                figura.src = "imagens/verao.svg";
                figura.alt = "Ilustração de tempo quente";
            } else {
                figura.src = "imagens/primavera.svg";
                figura.alt = "Ilustração de temperatura amena";
            }
            figura.classList.remove("d-none");
        }

        const resultado = document.getElementById("resultado");
        resultado.classList.remove("oculto");
        resultado.classList.remove("aparecer");
        setTimeout(() => resultado.classList.add("aparecer"), 10);

        salvarHistorico(name);
        buscarPrevisaoHojePorCoord(lat, lon);

    } catch (erro) {
        console.error("Erro ao buscar clima:", erro);
        alert("Desculpe, não foi possível obter os dados do clima. Tente novamente.");
    }
}

async function buscarPrevisaoHojePorCoord(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&lang=pt_br&units=metric`;

    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Falha na busca da previsão');
        const dados = await resposta.json();

        const hoje = new Date().toISOString().split("T")[0];
        const cardsDiv = document.getElementById("cards-previsao");
        cardsDiv.innerHTML = "";

        const previsoesHoje = dados.list.filter(item => item.dt_txt.startsWith(hoje));

        previsoesHoje.forEach((item) => {
            const hora = new Date(item.dt_txt).getHours();
            const temp = Math.round(item.main.temp);
            const icon = item.weather[0].icon;
            const desc = item.weather[0].description;

            const card = document.createElement("div");
            card.className = "text-center p-2 border rounded previsao-card";
            card.style.minWidth = "100px";
            card.innerHTML = `
                <strong>${hora}h</strong><br/>
                <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" /><br/>
                ${temp}°C
            `;
            cardsDiv.appendChild(card);
        });
    } catch (erro) {
        console.error("Erro ao buscar previsão por hora:", erro);
    }
}

function salvarHistorico(cidade) {
    let historico = JSON.parse(localStorage.getItem("historico")) || [];
    // Remove a cidade se já existir para colocá-la no topo
    historico = historico.filter(c => c.toLowerCase() !== cidade.toLowerCase());
    historico.unshift(cidade);
    historico = historico.slice(0, 3); // Mantém apenas os 3 mais recentes
    localStorage.setItem("historico", JSON.stringify(historico));
    mostrarHistorico();
}

function mostrarHistorico() {
    const historicoDiv = document.getElementById("historico");
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    if (historico.length === 0) {
        historicoDiv.innerHTML = "";
        return;
    }
    historicoDiv.innerHTML = "<h5>Últimas cidades:</h5>";
    historico.forEach((cidade) => {
        historicoDiv.innerHTML += `<button class="btn btn-outline-secondary btn-sm me-2 mb-2" onclick="buscarCidadeHistorico('${cidade}')">${cidade}</button>`;
    });
}

// MELHORIA: Clicar no histórico já busca o clima diretamente.
async function buscarCidadeHistorico(cidade) {
    document.getElementById("cidade").value = cidade;
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cidade)}&limit=1&appid=${apiKey}`;
    try {
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('Falha na busca da cidade');
        const dados = await resposta.json();
        if (dados.length > 0) {
            selecionarLocal(dados[0]);
        } else {
            alert("Não foi possível encontrar as coordenadas para a cidade do histórico.");
        }
    } catch (erro) {
        console.error("Erro ao buscar cidade do histórico:", erro);
        alert("Ocorreu um erro ao buscar a cidade do histórico. Verifique sua conexão.");
    }
}

// MELHORIA: Botão de tema muda de texto e ícone.
function alternarTema() {
    const body = document.body;
    body.classList.toggle("dark-mode");

    const botaoTema = document.querySelector('button[onclick="alternarTema()"]');
    if (body.classList.contains("dark-mode")) {
        botaoTema.innerHTML = "☀️ Modo Claro";
        botaoTema.setAttribute("aria-label", "Alternar para o modo claro");
    } else {
        botaoTema.innerHTML = "🌙 Modo Escuro";
        botaoTema.setAttribute("aria-label", "Alternar para o modo escuro");
    }
}

function inicializarMapa() {
    mapa = L.map("mapa").setView([-14.235, -51.925], 4); // Visão geral do Brasil
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapa);
}

function atualizarMapa(lat, lon) {
    if (mapa) {
        const mapaDiv = document.getElementById("mapa");
        mapaDiv.classList.add("visivel");
        mapa.setView([lat, lon], 12);
        // Remove marcadores antigos antes de adicionar um novo
        mapa.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                mapa.removeLayer(layer);
            }
        });
        L.marker([lat, lon]).addTo(mapa);
    }
}

function lerConteudo() {
    const nomeCidade = document.getElementById("nome-cidade")?.textContent;
    if (!nomeCidade) {
        // Não lê nada se não houver cidade pesquisada
        return;
    }
    const texto = `
    ${nomeCidade}
    ${document.getElementById("temperatura")?.textContent || ""}
    ${document.getElementById("descricao")?.textContent || ""}
    ${document.getElementById("sensacao")?.textContent || ""}
    ${document.getElementById("umidade")?.textContent || ""}
    ${document.getElementById("vento")?.textContent || ""}
  `.trim().replace(/\s+/g, ' '); // Limpa espaços extras

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
}