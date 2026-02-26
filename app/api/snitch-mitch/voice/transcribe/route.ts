import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

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
