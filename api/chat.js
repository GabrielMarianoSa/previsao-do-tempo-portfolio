// Arquivo: api/chat.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
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

  const API_KEY = process.env.GEMINI_API_KEY; // A Vercel vai preencher isso pra nós
  if (!API_KEY) {
    return res.status(500).json({ error: "Chave de API não configurada." });
  }

  const { mensagem, contexto } = req.body;

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let prompt = "";
    if (contexto === "curiosidade") {
      prompt = `Você é o SkyBot. O usuário pesquisou: "${mensagem}". Conte uma curiosidade curta (máx 2 frases) e divertida sobre o clima ou geografia desse local.`;
    } else {
      prompt = `Você é o SkyBot. Responda: "${mensagem}". Seja curto, simpático e útil.`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ reply: text });
  } catch (error) {
    return res.status(500).json({ error: "Erro na IA." });
  }
}
