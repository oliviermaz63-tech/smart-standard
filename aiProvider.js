// Fournisseur d'IA du backend : Claude (Anthropic) ou OpenAI, au choix.
//
// Tous les endpoints de server.js passent par aiComplete(), qui prend des
// messages au format "OpenAI" (system + user, le contenu user pouvant être
// une chaîne ou une liste de blocs texte / image_url) et renvoie le texte
// de la réponse. Changer de fournisseur ou de modèle se fait donc par
// variables d'environnement, sans toucher au reste du code :
//
//   AI_PROVIDER         "anthropic" ou "openai". Par défaut : "anthropic"
//                       si ANTHROPIC_API_KEY est défini, sinon "openai"
//                       (pour ne rien casser tant que la clé Claude n'est
//                       pas configurée sur Railway).
//   ANTHROPIC_API_KEY   clé API Claude (console.anthropic.com).
//   CLAUDE_MODEL_FAST   modèle rapide (texte). Défaut : claude-haiku-5-5
//   CLAUDE_MODEL_SMART  modèle plus fin (analyse d'images). Défaut : claude-sonnet-5-5
//   OPENAI_MODEL        modèle OpenAI de repli. Défaut : gpt-5.6-terra
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

const provider = () =>
  process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai");

let openaiClient = null;
let anthropicClient = null;

function getOpenAI() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function getAnthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

// data:image/jpeg;base64,XXXX -> bloc image Claude
function toClaudeImage(url) {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/s.exec(url || "");
  if (!match) throw new Error("Image invalide (data URL attendue).");
  return { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } };
}

function toClaudeContent(content) {
  if (typeof content === "string") return content;
  return content.map((part) =>
    part.type === "image_url" ? toClaudeImage(part.image_url.url) : { type: "text", text: part.text }
  );
}

// Sortie JSON : on force un appel d'outil, Claude renvoie alors directement
// un objet JSON valide (plus fiable que de lui demander du JSON en texte).
const JSON_TOOL = {
  name: "submit_result",
  description: "Renvoie le résultat structuré demandé (JSON).",
  input_schema: { type: "object", additionalProperties: true },
};

async function completeWithClaude({ tier, json, maxTokens, messages }) {
  const model =
    tier === "smart"
      ? process.env.CLAUDE_MODEL_SMART || "claude-sonnet-5-5"
      : process.env.CLAUDE_MODEL_FAST || "claude-haiku-5-5";

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const chat = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: toClaudeContent(m.content) }));

  const response = await getAnthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: chat,
    ...(json ? { tools: [JSON_TOOL], tool_choice: { type: "tool", name: JSON_TOOL.name } } : {}),
  });

  if (json) {
    const block = response.content.find((b) => b.type === "tool_use");
    if (!block) throw new Error("Claude n'a pas renvoyé de résultat structuré.");
    return JSON.stringify(block.input);
  }
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function completeWithOpenAI({ json, messages }) {
  const completion = await getOpenAI().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    reasoning_effort: "none",
    ...(json ? { response_format: { type: "json_object" } } : {}),
    messages,
  });
  return completion.choices[0].message.content;
}

// tier : "fast" (texte, le plus rapide) ou "smart" (analyse d'images).
// json : true pour obtenir une chaîne JSON valide.
export function aiComplete({ tier = "fast", json = false, maxTokens = 8000, messages }) {
  return provider() === "anthropic"
    ? completeWithClaude({ tier, json, maxTokens, messages })
    : completeWithOpenAI({ json, messages });
}

export function currentProvider() {
  return provider();
}
