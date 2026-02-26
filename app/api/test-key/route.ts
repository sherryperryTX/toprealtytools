import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey } = await req.json();

    if (!anthropicKey) {
      return Response.json({ success: false, error: "No key provided" });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say hi" }],
    });

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error?.message?.includes("401")
        ? "Invalid API key. Please check and try again."
        : error?.message?.includes("insufficient")
        ? "API key is valid but has no credits. Please add credits at console.anthropic.com."
        : error?.message || "Could not verify key.",
    });
  }
}
