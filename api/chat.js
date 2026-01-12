// Arquivo: api/chat.js

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const pickOne = (items) => {
  if (!items || items.length === 0) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
};

const knowledgeBase = {
  // Country code (OpenWeather uses ISO-3166-1 alpha-2)
  country: {
    JP: [
      "Em grande parte do Japão, o período de chuvas (tsuyu) costuma acontecer entre junho e julho, com variações por região.",
      "No Japão, a temporada de tufões costuma influenciar mais entre agosto e outubro, principalmente em áreas costeiras.",
      "No inverno, regiões montanhosas e o norte do Japão costumam ter neve, enquanto áreas mais ao sul tendem a ser mais amenas.",
    ],
    SE: [
      "No norte da Suécia, a aurora boreal costuma ser mais fácil de ver entre setembro e março, em noites longas e com céu limpo.",
      "No verão do norte da Suécia, pode ocorrer o fenômeno do sol da meia-noite (dias muito longos), especialmente entre maio e julho.",
      "No inverno sueco, os dias ficam bem curtos nas latitudes altas, e o frio costuma ser mais intenso longe do litoral.",
    ],
    NO: [
      "No norte da Noruega, a aurora boreal costuma ser mais visível de setembro a março, quando as noites são mais escuras.",
      "Em áreas costeiras da Noruega, a influência do mar costuma deixar o clima mais úmido e com mudanças rápidas.",
    ],
    FI: [
      "No norte da Finlândia, a aurora boreal costuma ser observada com mais chance entre setembro e março, longe das luzes da cidade.",
      "Na Finlândia, o inverno pode trazer neve persistente em várias regiões, e o verão tende a ter dias bem longos nas latitudes altas.",
    ],
    IS: [
      "Na Islândia, o tempo pode mudar rápido: sol, vento e chuva no mesmo dia não é incomum, por causa do Atlântico Norte.",
      "Na Islândia, a aurora boreal costuma ser mais observável de setembro a abril, em noites escuras e céu limpo.",
    ],
    BR: [
      "No Brasil, padrões de chuva e temperatura variam muito por região; em geral, o verão tende a ser mais chuvoso em várias áreas do país.",
      "Em partes do Brasil, a transição entre estações pode trazer mudanças rápidas de umidade e pancadas de chuva, dependendo da região.",
    ],
    US: [
      "Nos EUA, o clima varia bastante: regiões costeiras, desérticas e continentais podem ter padrões bem diferentes na mesma época do ano.",
      "Em boa parte dos EUA, a primavera e o outono costumam ser períodos de transição com mudanças de temperatura mais rápidas.",
    ],
    GB: [
      "No Reino Unido, a combinação de ventos e influência marítima costuma deixar o tempo variável e com chance de chuva ao longo do ano.",
    ],
    CA: [
      "No Canadá, a diferença entre estações pode ser bem marcada; no inverno, muitas regiões têm neve e frio intenso, especialmente no interior.",
    ],
  },
  // City-level (best-effort; used when user searches a known city)
  city: {
    tokyo: [
      "Tóquio costuma ter verões quentes e úmidos; a época das chuvas (tsuyu) geralmente influencia o começo do verão, com variações anuais.",
      "Em Tóquio, o fim do verão pode ter mais instabilidade por influência de tufões no Japão, dependendo do ano.",
    ],
    kyoto: [
      "Kyoto costuma ter verões quentes e úmidos e invernos mais frios; por estar no interior, a amplitude térmica tende a ser maior do que em áreas costeiras.",
    ],
    stockholm: [
      "Estocolmo tem estações bem definidas; no inverno, os dias ficam mais curtos e as temperaturas costumam cair bastante.",
    ],
  },
};

const getCuriosity = ({ place, meta }) => {
  const placeNorm = normalizeText(place);

  // City first (more specific)
  const cityKey = placeNorm.split(",")[0].replace(/\s+/g, " ");
  const cityList =
    knowledgeBase.city[cityKey] ||
    knowledgeBase.city[cityKey.replace(/\s/g, "")];
  const cityPick = pickOne(cityList);
  if (cityPick) return cityPick;

  // Country code from meta (OpenWeather)
  const countryCode = meta && typeof meta === "object" ? meta.country : null;
  if (countryCode && knowledgeBase.country[countryCode]) {
    return pickOne(knowledgeBase.country[countryCode]);
  }

  // Country name typed by user (best-effort)
  const nameMatches = [
    [/(\bjapao\b|\bjapan\b)/i, "JP"],
    [/(\bsuecia\b|\bsweden\b)/i, "SE"],
    [/(\bnoruega\b|\bnorway\b)/i, "NO"],
    [/(\bfinlandia\b|\bfinland\b)/i, "FI"],
    [/(\bislandia\b|\biceland\b)/i, "IS"],
    [/(\bbrasil\b|\bbrazil\b)/i, "BR"],
    [/(\bestados unidos\b|\beua\b|\busa\b|\bunited states\b)/i, "US"],
    [/(\breino unido\b|\buk\b|\bunited kingdom\b)/i, "GB"],
    [/(\bcanada\b)/i, "CA"],
  ];
  for (const [re, code] of nameMatches) {
    if (re.test(placeNorm) && knowledgeBase.country[code]) {
      return pickOne(knowledgeBase.country[code]);
    }
  }

  return null;
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const HF_API_KEY = process.env.HF_API_KEY; // Hugging Face token (free tier available)

  const { mensagem, contexto, meta } = req.body || {};
  // helper: sanitize replies
  const sanitize = (t) => {
    if (!t) return t;
    let s = String(t).trim();
    s = s.replace(/^💡\s*/u, "");
    s = s.replace(/^Curiosidad(?:e|es)?[:\-–—]?\s*/iu, "");
    s = s.replace(/^Curiosidade[:\-–—]?\s*/iu, "");
    return s;
  };

  // Cria prompt mais instruído, usando metadados se fornecidos
  let prompt = "";
  if (contexto === "curiosidade") {
    const place = mensagem || "esta cidade";

    // 0) Curiosidades curadas (mais legais e mais estáveis do que tentar inventar por latitude)
    try {
      const curated = getCuriosity({ place, meta });
      if (curated) {
        return res.status(200).json({ reply: sanitize(curated), source: "kb" });
      }
    } catch (e) {
      console.error("Curated curiosity error:", e);
    }

    let metaText = "";
    if (meta && typeof meta === "object") {
      if (meta.country) metaText += ` País: ${meta.country}.`;
      if (meta.lat && meta.lon)
        metaText += ` Coordenadas: ${meta.lat}, ${meta.lon}.`;
      if (meta.temp !== undefined)
        metaText += ` Temperatura atual aproximada: ${meta.temp}°C.`;
      if (meta.description)
        metaText += ` Condição observada: ${meta.description}.`;
    }

    // If metadata available, generate a simple local curiosity (fallback)
    try {
      if (
        meta &&
        typeof meta === "object" &&
        (meta.lat !== undefined || meta.description || meta.temp !== undefined)
      ) {
        const cityName = String(place).split(",")[0];
        const country = meta.country || "";
        const lat = Number(meta.lat || 0);
        void lat;

        const desc = (meta.description || "").toLowerCase();
        let note = "";
        if (/rain|chuva|storm|shower|chuvoso/i.test(desc))
          note = "costuma apresentar períodos de chuva bem marcados";
        else if (/snow|neve|nublado|nevasca/i.test(desc))
          note =
            "tem episódios de frio e, em algumas áreas, queda de neve no inverno";
        else if (/clear|ensolarado|sunny/i.test(desc))
          note = "frequentemente tem dias ensolarados";
        else note = "apresenta variações sazonais típicas da região";

        const tempPart =
          meta.temp !== undefined
            ? ` Agora está por volta de ${meta.temp}°C.`
            : "";
        const countryPart = country ? `, ${country}` : "";
        const curiosity = `Em ${cityName}${countryPart}, ${note}.${tempPart}`;
        return res.status(200).json({ reply: sanitize(curiosity) });
      }
    } catch (e) {
      console.error("Meta-generated curiosity error:", e);
    }

    // Busca preferencial: procurar por página de 'climate' da cidade primeiro
    try {
      const base = String(place).split(",")[0].replace(/\s+/g, "_");
      const candidates = [
        `Climate_of_${base}`,
        `${base}_climate`,
        `Climate_in_${base}`,
        `${base}_weather`,
      ];
      for (const c of candidates) {
        try {
          const title = encodeURIComponent(c);
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
          const sumResp = await fetch(summaryUrl, {
            headers: { "User-Agent": "SkyBot/1.0 (portfolio)" },
          });
          if (sumResp.ok) {
            const sumJson = await sumResp.json();
            const extract2 = sumJson.extract || "";
            if (extract2) {
              const s = extract2.match(/[^.?!]+[.?!]+/g) || [extract2];
              const text = s.slice(0, 2).join(" ").replace(/\n/g, " ");
              return res.status(200).json({ reply: sanitize(text) });
            }
          }
        } catch (inner) {
          /* ignore and try next */
        }
      }
      // fallback to broader search if candidates not found
      const query = String(place).split(",")[0] + " climate";
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&srprop=`;
      const sresp = await fetch(searchUrl, {
        headers: { "User-Agent": "SkyBot/1.0 (portfolio)" },
      });
      if (sresp.ok) {
        const sjson = await sresp.json();
        const first =
          sjson.query && sjson.query.search && sjson.query.search[0];
        if (first && first.title) {
          const title = encodeURIComponent(first.title);
          const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
          const sumResp = await fetch(summaryUrl, {
            headers: { "User-Agent": "SkyBot/1.0 (portfolio)" },
          });
          if (sumResp.ok) {
            const sumJson = await sumResp.json();
            const extract2 = sumJson.extract || "";
            if (extract2) {
              const s = extract2.match(/[^.?!]+[.?!]+/g) || [extract2];
              const text = s.slice(0, 2).join(" ").replace(/\n/g, " ");
              return res.status(200).json({ reply: sanitize(text) });
            }
          }
        }
      }
    } catch (se) {
      console.error("Wikipedia climate search error:", se);
    }

    // Se não encontrou página de clima, usar o resumo da página principal da cidade
    try {
      const wikiTitle = encodeURIComponent(String(place).split(",")[0]);
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`;
      const wikiResp = await fetch(wikiUrl, {
        headers: { "User-Agent": "SkyBot/1.0 (portfolio)" },
      });
      if (wikiResp.ok) {
        const wikiJson = await wikiResp.json();
        const extract = wikiJson.extract || "";
        if (extract) {
          const first = (extract.split(/\. |\n/)[0] || extract).trim();
          return res.status(200).json({ reply: sanitize(first) });
        }
      }
    } catch (e) {
      console.error("Wikipedia fetch error:", e);
    }

    // Tentar extrair seção 'Climate' da página se disponível (mobile-sections)
    try {
      const city = String(place).split(",")[0];
      const mobileUrl = `https://en.wikipedia.org/api/rest_v1/page/mobile-sections/${encodeURIComponent(
        city
      )}`;
      const mresp = await fetch(mobileUrl, {
        headers: { "User-Agent": "SkyBot/1.0 (portfolio)" },
      });
      if (mresp.ok) {
        const mjson = await mresp.json();
        const sections = (mjson && mjson.sections) || [];
        for (const sec of sections) {
          const title = sec?.line || sec?.title || "";
          if (/climate|clima|weather|temperatur|chuva|estação/i.test(title)) {
            const textHtml = sec?.text || "";
            const text = String(textHtml)
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            const s = text.match(/[^.?!]+[.?!]+/g) || [text];
            const out = s.slice(0, 2).join(" ");
            return res.status(200).json({ reply: sanitize(out) });
          }
        }
      }
    } catch (ms) {
      console.error("Wikipedia mobile-sections error:", ms);
    }

    prompt = `Você é o SkyBot (em português). O usuário pesquisou: "${place}".${metaText} Produza UMA curiosidade curta e verdadeira (máx 2 frases) sobre o clima ou geografia de ${place}. Prefira padrões sazonais (ex.: época de chuvas, inverno mais escuro, aurora boreal), mas se não tiver certeza, use linguagem cuidadosa como "em geral"/"costuma" e não invente números.`;
  } else {
    prompt = `Você é o SkyBot. Responda: "${mensagem}". Seja curto, simpático e útil.`;
  }

  // 1) Preferir Hugging Face Inference (possui free tier). Configure HF_API_KEY no Vercel.
  if (HF_API_KEY) {
    try {
      // A API antiga (api-inference.huggingface.co) retornou 410; o caminho suportado hoje é o Router OpenAI-compatible.
      const modelsToTry = [
        "katanemo/Arch-Router-1.5B:hf-inference",
        "aisingapore/Qwen-SEA-LION-v4-32B-IT:publicai",
      ];

      for (const model of modelsToTry) {
        const hfUrl = "https://router.huggingface.co/v1/chat/completions";
        const hfResp = await fetch(hfUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: String(prompt) }],
            stream: false,
            max_tokens: 120,
            temperature: 0.7,
          }),
        });

        const hfText = await hfResp.text();
        let hfJson;
        try {
          hfJson = JSON.parse(hfText);
        } catch {
          hfJson = null;
        }

        if (!hfResp.ok) {
          const msg =
            hfJson?.error?.message || hfText || `HTTP ${hfResp.status}`;
          console.error(
            "HuggingFace router chat error:",
            model,
            hfResp.status,
            msg
          );
          continue;
        }

        const text =
          hfJson?.choices?.[0]?.message?.content ||
          hfJson?.choices?.[0]?.text ||
          "";
        if (text && String(text).trim()) {
          return res.status(200).json({ reply: sanitize(text) });
        }
      }
    } catch (err) {
      console.error("HuggingFace error:", err);
      // continua para tentar fallback
    }
  }

  // (Sem Gemini) — mantemos HF + Wikipedia/meta para estabilidade e evitar vazamento de chave no frontend.

  // Se tudo falhar, retornar um fallback mock útil para desenvolvimento/portfólio
  try {
    const cidade = (mensagem || "este lugar").toString();
    const missingKey = !HF_API_KEY;
    const mock = missingKey
      ? "Configuração pendente: defina a variável HF_API_KEY no servidor (Vercel) para ativar a IA. Por enquanto estou em modo demonstração."
      : contexto === "curiosidade"
      ? `💡 Curiosidade: ${cidade} tem um clima único — lembre-se de sempre checar a previsão antes de sair!`
      : `Oi! Posso ajudar com o clima de ${cidade}. Pergunte algo específico que eu respondo.`;
    return res
      .status(200)
      .json({ reply: mock, _mock: true, needsSetup: missingKey });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "Nenhuma chave de IA configurada e fallback falhou." });
  }
}
