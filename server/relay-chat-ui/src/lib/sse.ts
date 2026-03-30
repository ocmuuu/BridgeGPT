export function applyOpenAiSseBlock(
  block: string,
  prev: string,
  sseLineSep: string
): string {
  let full = prev;
  const lines = block.split(sseLineSep);
  for (const line of lines) {
    const trimmed = line.replace(/\r$/, "");
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") continue;
    try {
      const obj = JSON.parse(data) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const ch = obj.choices?.[0];
      if (ch?.delta && typeof ch.delta.content === "string") {
        full += ch.delta.content;
      }
    } catch {
      /* ignore */
    }
  }
  return full;
}

export function applyGeminiSseBlock(
  block: string,
  prev: string,
  sseLineSep: string
): string {
  let full = prev;
  const lines = block.split(sseLineSep);
  for (const line of lines) {
    const trimmed = line.replace(/\r$/, "");
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    let obj: {
      error?: { message?: string; status?: string };
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    try {
      obj = JSON.parse(data);
    } catch {
      continue;
    }
    if (obj.error) {
      throw new Error(
        obj.error.message ||
          String(obj.error.status || "Gemini API error")
      );
    }
    const cand = obj.candidates?.[0];
    const parts = cand?.content?.parts;
    if (parts?.[0] && typeof parts[0].text === "string") {
      full += parts[0].text;
    }
  }
  return full;
}

export async function readSseStream(
  res: Response,
  sseBlockSep: string,
  sseLineSep: string,
  backend: "openai" | "gemini",
  onDelta: (fullText: string) => void
): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  const apply =
    backend === "gemini" ? applyGeminiSseBlock : applyOpenAiSseBlock;

  while (true) {
    const part = await reader.read();
    if (part.done) break;
    buf += dec.decode(part.value, { stream: true });
    for (;;) {
      const ix = buf.indexOf(sseBlockSep);
      if (ix === -1) break;
      const block = buf.slice(0, ix).trim();
      buf = buf.slice(ix + sseBlockSep.length);
      if (block) {
        full = apply(block, full, sseLineSep);
        onDelta(full);
      }
    }
  }
  if (buf.trim()) {
    full = apply(buf.trim(), full, sseLineSep);
    onDelta(full);
  }
  return full;
}
