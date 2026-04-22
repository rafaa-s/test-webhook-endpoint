import { appConfig } from "@/lib/config";

type OllamaGenerateResponse = {
  response?: string;
};

function extractJsonObject(text: string) {
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1] || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Ollama did not return a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateJsonWithOllama<T>(payload: {
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  const response = await fetch(`${appConfig.ollamaBaseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      model: appConfig.ollamaModel,
      system: payload.system,
      prompt: payload.prompt,
      stream: false,
      format: "json",
      options: {
        temperature: payload.temperature ?? 0.35,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;
  if (!data.response) {
    throw new Error("Ollama returned an empty response.");
  }

  return extractJsonObject(data.response) as T;
}
