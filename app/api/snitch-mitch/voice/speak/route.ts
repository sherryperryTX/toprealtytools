import OpenAI from "openai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text, userOpenaiKey } = await req.json();

    if (!text) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    // Clean text for speech — remove markdown formatting
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/`.*?`/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .trim();

    // Limit to ~4000 chars for TTS
    const truncated = cleanText.slice(0, 4000);

    // Use user's key if provided, otherwise fall back to platform key
    const apiKey = userOpenaiKey || process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx", // Deep, authoritative male voice — perfect for an inspector
      input: truncated,
      speed: 1.05,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    return Response.json({ error: error.message || "Speech generation failed" }, { status: 500 });
  }
}
