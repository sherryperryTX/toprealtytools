import OpenAI from "openai";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const userOpenaiKey = formData.get("openaiKey") as string | null;

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Use user's key if provided, otherwise fall back to platform key
    const apiKey = userOpenaiKey || process.env.OPENAI_API_KEY;
    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    return Response.json({ text: transcription.text });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return Response.json({ error: error.message || "Transcription failed" }, { status: 500 });
  }
}
