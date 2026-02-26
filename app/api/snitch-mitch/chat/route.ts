import Anthropic from "@anthropic-ai/sdk";
import { SNITCH_MITCH_SYSTEM_PROMPT } from "@/lib/snitch-mitch/system-prompt";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, inspectionContext } = await req.json();

    // Build system prompt with inspection context
    let systemPrompt = SNITCH_MITCH_SYSTEM_PROMPT;
    if (inspectionContext) {
      systemPrompt += `\n\n## Current Inspection Context\n${inspectionContext}`;
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: any) => {
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        // Message with images
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

    // Create a ReadableStream for streaming response
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
        } catch (err) {
          controller.error(err);
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
    console.error("Chat API error:", error);
    return Response.json({ error: error.message || "Chat failed" }, { status: 500 });
  }
}
