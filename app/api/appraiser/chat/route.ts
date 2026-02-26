import Anthropic from "@anthropic-ai/sdk";
import { APPRAISER_SYSTEM_PROMPT } from "@/lib/appraiser/system-prompt";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, appraisalContext, userAnthropicKey } = body;

    // Use user's key if provided, otherwise fall back to platform key
    const apiKey = userAnthropicKey || process.env.ANTHROPIC_API_KEY;
    const anthropic = new Anthropic({ apiKey });

    // Build system prompt with appraisal context
    let systemPrompt = APPRAISER_SYSTEM_PROMPT;
    if (appraisalContext) {
      systemPrompt += `\n\n## Current Appraisal Data\n${appraisalContext}`;
    }

    // Convert messages to Anthropic format — only send the last 10 messages
    const recentMessages = messages.slice(-10);
    const anthropicMessages = recentMessages.map((msg: any) => {
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const content: any[] = [];
        for (const img of msg.images) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: img.mediaType || "image/jpeg",
              data: img.data,
            },
          });
        }
        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        return { role: "user", content };
      }
      return { role: msg.role, content: msg.content };
    });

    // Stream response from Claude
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err: any) {
          console.error("Stream error:", err?.message || err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "\n\n[Error: " + (err?.message || "Stream failed") + "]" })}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Appraiser Chat API error:", error?.message || error);
    return Response.json(
      { error: error?.message || "Chat failed" },
      { status: error?.message?.includes("too large") ? 413 : 500 }
    );
  }
}
