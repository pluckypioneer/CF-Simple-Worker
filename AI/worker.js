const MODELS = {
  "glm-4.7-flash": { id: "@cf/zai-org/glm-4.7-flash", type: "chat" },
  m2m100: { id: "@cf/meta/m2m100-1.2b", type: "translation" },
};
const DEFAULT_MODEL = "glm-4.7-flash";
const json = (value, status = 200) => Response.json(value, { status });
const error = (message, status = 400) => json({ error: { message } }, status);

function completion(result, model, id, created) {
  // 新接口已经返回 OpenAI 格式，保留上游的 choices / usage。
  if (Array.isArray(result?.choices)) {
    return { ...result, model };
  }
  const content = result?.response ?? result?.text ?? result?.translated_text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Upstream returned no assistant content");
  }
  return {
    id, object: "chat.completion", created, model,
    choices: [{ index: 0, message: { role: "assistant", content },
      // 旧接口没有结束原因时保留 unknown，不能伪装为正常完成。
      finish_reason: result.finish_reason ?? null }],
    ...(result.usage ? { usage: result.usage } : {}),
  };
}

function convertStream(source, model, id, created) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = source.getReader();
  let buffer = "";
  let ended = false;
  const chunk = (choices, extra = {}) => ({
    id, object: "chat.completion.chunk", created, model, choices, ...extra,
  });
  return new ReadableStream({
    async start(controller) {
      const emit = value => controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      const event = frame => {
        const data = frame.split("\n").filter(line => line.startsWith("data:"))
          .map(line => line.slice(5).trimStart()).join("\n");
        if (!data) return;
        if (data.trim() === "[DONE]") { ended = true; return; }
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error("Upstream stream reported an error");
        if (Array.isArray(parsed.choices)) {
          emit({ ...parsed, id, model });
          return;
        }
        const content = parsed.response ?? parsed.text ?? parsed.content;
        if (content !== undefined && typeof content !== "string") {
          throw new Error("Unsupported upstream stream content");
        }
        if (content || parsed.finish_reason != null) {
          emit(chunk([{ index: 0, delta: content ? { content } : {},
            finish_reason: parsed.finish_reason ?? null }],
            parsed.usage ? { usage: parsed.usage } : {}));
        } else if (parsed.usage) {
          emit(chunk([], { usage: parsed.usage }));
        }
      };
      try {
        while (!ended) {
          const { done, value } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          // 保留未完成的 SSE 事件，兼容 CRLF 和跨网络块的换行。
          let boundary;
          while (!ended && (boundary = /\r?\n\r?\n/.exec(buffer))) {
            const frame = buffer.slice(0, boundary.index).replace(/\r\n/g, "\n");
            buffer = buffer.slice(boundary.index + boundary[0].length);
            event(frame);
          }
          if (done) {
            if (!ended && buffer.trim()) event(buffer.replace(/\r\n/g, "\n"));
            break;
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // 错误必须传给客户端，不能吞掉后伪装为成功结束。
        console.error("AI stream failed", { message: err.message });
        controller.error(err);
      } finally {
        try { await reader.cancel(); } catch {}
        reader.releaseLock();
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

export default {
  async fetch(request, env) {
    if (!env.PROXY_API_KEY) return error("PROXY_API_KEY is not configured", 503);
    if (request.headers.get("Authorization") !== `Bearer ${env.PROXY_API_KEY}`) {
      return error("Invalid API Key", 401);
    }
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (path === "/v1/models" && request.method === "GET") {
      return json({ object: "list", data: Object.keys(MODELS).map(id => ({
        id, object: "model", created: 1700000000, owned_by: "cloudflare-workers-ai",
      })) });
    }
    if (path !== "/v1/chat/completions") return error("Not found", 404);
    if (request.method !== "POST") return error("Method not allowed", 405);
    if (!env.AI) return error("AI binding is missing", 503);
    let body;
    try { body = await request.json(); } catch { return error("Invalid JSON body"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return error("Invalid request body");
    // 清理复制模型名时可能混入的零宽字符。
    const model = typeof body.model === "string"
      ? body.model.replace(/[\u200B-\u200D\uFEFF]/g, "").trim() : DEFAULT_MODEL;
    const config = MODELS[model];
    if (!config) return error(`Unsupported model: ${model}`, 404);
    if (!Array.isArray(body.messages) || !body.messages.length) return error("Missing messages array");
    const limit = body.max_completion_tokens ?? body.max_tokens ?? 16000;
    if (!Number.isInteger(limit) || limit <= 0) return error("Token limit must be a positive integer");
    if (body.stream !== undefined && typeof body.stream !== "boolean") return error("stream must be a boolean");
    const stream = body.stream === true;
    const id = `chatcmpl-${crypto.randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    try {
      if (config.type === "translation") {
        if (stream) return error("m2m100 supports non-streaming requests only");
        const text = body.messages.at(-1)?.content;
        if (typeof text !== "string" || !text.trim()) return error("Translation requires text content");
        const result = await env.AI.run(config.id, {
          text, target_lang: body.target_lang ?? (/[\u4e00-\u9fff]/.test(text) ? "en" : "zh"),
          ...(body.source_lang ? { source_lang: body.source_lang } : {}),
        });
        return json(completion(result, model, id, created));
      }
      const input = {
        messages: body.messages, stream, max_completion_tokens: limit,
        chat_template_kwargs: { enable_thinking: false, ...(body.chat_template_kwargs ?? {}) },
      };
      for (const key of ["temperature", "top_p", "top_k", "stop", "seed",
        "frequency_penalty", "presence_penalty", "response_format", "tools", "tool_choice",
        "parallel_tool_calls", "stream_options"]) {
        if (body[key] !== undefined) input[key] = body[key];
      }
      console.log("AI request", { id, model, stream, max_completion_tokens: limit });
      const result = await env.AI.run(config.id, input);
      if (stream) {
        if (!result || typeof result.getReader !== "function") throw new Error("Upstream did not return a stream");
        return new Response(convertStream(result, model, id, created), {
          headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
        });
      }
      const response = completion(result, model, id, created);
      console.log("AI response", { id, finish_reason: response.choices?.[0]?.finish_reason,
        usage: response.usage, content_length: response.choices?.[0]?.message?.content?.length });
      return json(response);
    } catch (err) {
      console.error("AI upstream failed", { id, message: err.message });
      return error("Workers AI request failed; check Worker logs", 502);
    }
  },
};
