// 定义可用的模型映射
const MODELS_MAP = {
  "glm-4.7-flash": { cfId: "@cf/zai-org/glm-4.7-flash", type: "chat" },
  "m2m100": { cfId: "@cf/meta/m2m100-1.2b", type: "translation" }
};

const DEFAULT_MODEL = "glm-4.7-flash";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const authHeader = request.headers.get("Authorization");

    // 1. API Key 鉴权校验
    if (env.PROXY_API_KEY) {
      if (!authHeader || authHeader !== `Bearer ${env.PROXY_API_KEY}`) {
        return new Response(JSON.stringify({ error: { message: "Invalid API Key", type: "invalid_request_error" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. 处理 GET /v1/models
    if (url.pathname === "/v1/models" && request.method === "GET") {
      return new Response(JSON.stringify({
        object: "list",
        data: Object.keys(MODELS_MAP).map(id => ({
          id: id,
          object: "model",
          created: 1700000000,
          owned_by: "cloudflare-workers-ai"
        }))
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. 处理 POST /v1/chat/completions
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      if (!env.AI) {
        return new Response(JSON.stringify({ error: { message: "AI binding is missing in Cloudflare Worker settings." } }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      try {
        const body = await request.json();
        const requestedModel = body.model || DEFAULT_MODEL;
        const modelConfig = MODELS_MAP[requestedModel] || MODELS_MAP[DEFAULT_MODEL];
        
        const messages = body.messages || [];
        const stream = body.stream === true;

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: { message: "Missing messages array" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // ===== 场景 A：专属翻译模型 (M2M100) =====
        if (modelConfig.type === "translation") {
          const lastMsg = messages[messages.length - 1].content || "";
          const target_lang = /[\u4e00-\u9fa5]/.test(lastMsg) ? "en" : "zh";
          
          const transRes = await env.AI.run(modelConfig.cfId, { text: lastMsg, target_lang });
          const translatedText = transRes?.translated_text || "Translation failed";

          if (stream) {
            const encoder = new TextEncoder();
            const readableStream = new ReadableStream({
              start(controller) {
                const chunk = {
                  id: "chatcmpl-" + Date.now(),
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: requestedModel,
                  choices: [{ index: 0, delta: { content: translatedText }, finish_reason: "stop" }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            });
            return new Response(readableStream, { headers: { "Content-Type": "text/event-stream" } });
          } else {
            return new Response(JSON.stringify({
              id: "chatcmpl-" + Date.now(),
              object: "chat.completion",
              created: Math.floor(Date.now() / 1000),
              model: requestedModel,
              choices: [{ index: 0, message: { role: "assistant", content: translatedText }, finish_reason: "stop" }]
            }), { headers: { "Content-Type": "application/json" } });
          }
        }

        // ===== 场景 B：主力智能对话模型 (GLM-4.7-Flash，带推理过滤) =====
        if (stream) {
          // 加上 chat_template_kwargs: { enable_thinking: false } 可以直接关闭模型的冗余思考过程，提高返回稳定性
          const aiStream = await env.AI.run(modelConfig.cfId, { 
            messages, 
            stream: true,
            chat_template_kwargs: { enable_thinking: false } 
          });
          const encoder = new TextEncoder();

          const readableStream = new ReadableStream({
            async start(controller) {
              const reader = aiStream.getReader();
              const decoder = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split("\n");
                  for (const line of lines) {
                    if (line.trim().startsWith("data:")) {
                      const dataStr = line.replace("data:", "").trim();
                      if (dataStr === "[DONE]") {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        continue;
                      }
                      try {
                        const parsed = JSON.parse(dataStr);
                        // 兼容处理：有些版本返回 response，有些返回 text 或 content
                        const token = parsed.response || parsed.text || parsed.content || "";
                        if (token) {
                          const openAIChunk = {
                            id: "chatcmpl-" + Date.now(),
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: requestedModel,
                            choices: [{ index: 0, delta: { content: token }, finish_reason: null }]
                          };
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
                        }
                      } catch {}
                    }
                  }
                }
              } catch (e) {
                console.error("Stream error:", e);
              } finally {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            }
          });

          return new Response(readableStream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive"
            }
          });
        } 
        
        // 非流式响应
        else {
          const aiResponse = await env.AI.run(modelConfig.cfId, { 
            messages,
            chat_template_kwargs: { enable_thinking: false }
          });
          const replyText = aiResponse.response || aiResponse.text || "";

          const openAIResponse = {
            id: "chatcmpl-" + Date.now(),
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: requestedModel,
            choices: [{ index: 0, message: { role: "assistant", content: replyText }, finish_reason: "stop" }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          };

          return new Response(JSON.stringify(openAIResponse), {
            headers: { "Content-Type": "application/json" }
          });
        }

      } catch (err) {
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
