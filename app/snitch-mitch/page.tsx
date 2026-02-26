"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MITCH_GREETING } from "@/lib/snitch-mitch/system-prompt";
import { INSPECTION_AREAS, DEFAULT_INSPECTION_ORDER, type InspectionArea } from "@/lib/snitch-mitch/inspection-areas";
import type { Finding, InspectionReport } from "@/lib/snitch-mitch/report-builder";
import AuthGuard from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";

// ===== Types =====
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: { data: string; mediaType: string; preview: string }[];
  timestamp: Date;
}

type InspectionMode = "none" | "full" | "quick";

export default function SnitchMitchPage() {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greeting",
      role: "assistant",
      content: MITCH_GREETING,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Photo state
  const [pendingImages, setPendingImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inspection state
  const [inspectionMode, setInspectionMode] = useState<InspectionMode>("none");
  const [currentAreaIndex, setCurrentAreaIndex] = useState(0);
  const [inspectionOrder, setInspectionOrder] = useState(DEFAULT_INSPECTION_ORDER);
  const [completedAreas, setCompletedAreas] = useState<string[]>([]);
  const [propertyAddress, setPropertyAddress] = useState("");

  // Findings state
  const [findings, setFindings] = useState<Finding[]>([]);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Chat Functions =====
  const sendMessage = useCallback(async (text: string, images?: { data: string; mediaType: string; preview: string }[]) => {
    if (!text.trim() && (!images || images.length === 0)) return;
    if (isStreaming) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      images,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setPendingImages([]);
    setIsStreaming(true);

    // Build inspection context
    let inspectionContext = "";
    if (inspectionMode === "full") {
      const currentArea = INSPECTION_AREAS.find(a => a.id === inspectionOrder[currentAreaIndex]);
      inspectionContext = `Mode: Full Home Inspection\nProperty: ${propertyAddress || "Not yet specified"}\nCurrent Area: ${currentArea?.name || "Starting"}\nCompleted Areas: ${completedAreas.join(", ") || "None yet"}\nFindings so far: ${findings.length}`;
    } else if (inspectionMode === "quick") {
      inspectionContext = `Mode: Quick Situation Inspection\nFindings so far: ${findings.length}`;
    }

    // Prepare messages for API (exclude greeting images/previews to save tokens)
    const apiMessages = newMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      images: msg.images?.map(img => ({ data: img.data, mediaType: img.mediaType })),
    }));

    try {
      const response = await fetch("/api/snitch-mitch/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, inspectionContext }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      // Add empty assistant message to start streaming into
      setMessages(prev => [...prev, {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantId ? { ...msg, content: assistantContent } : msg
                  )
                );
              }
            } catch {}
          }
        }
      }

      // Auto-speak if voice is enabled
      if (voiceEnabled && assistantContent) {
        speakText(assistantContent);
      }

      // Parse findings from response if it contains structured data
      parseFindingsFromResponse(assistantContent);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I had trouble processing that. Can you try again?",
        timestamp: new Date(),
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, inspectionMode, currentAreaIndex, inspectionOrder, completedAreas, findings, propertyAddress, voiceEnabled]);

  // Parse findings from Mitch's response
  function parseFindingsFromResponse(text: string) {
    // Look for structured finding patterns
    const issueMatch = text.match(/\*\*What it is\*\*:?\s*(.+)/i);
    const classMatch = text.match(/\*\*Classification\*\*:?\s*(Code Issue|Repair Issue)/i);
    const severityMatch = text.match(/\*\*Severity\*\*:?\s*(Critical|Major|Minor|Cosmetic)/i);
    const costMatch = text.match(/\*\*Cost to Cure\*\*:?\s*\$?([\d,]+)\s*[-–—to]+\s*\$?([\d,]+)/i);
    const recMatch = text.match(/\*\*Recommendation\*\*:?\s*(.+)/i);

    if (issueMatch && severityMatch) {
      const currentArea = INSPECTION_AREAS.find(a => a.id === inspectionOrder[currentAreaIndex]);
      const newFinding: Finding = {
        id: Date.now().toString(),
        area: currentArea?.name || "General",
        issue: issueMatch[1].trim(),
        classification: (classMatch?.[1] as any) || "Repair Issue",
        severity: (severityMatch?.[1] as any) || "Minor",
        costLow: costMatch ? parseInt(costMatch[1].replace(/,/g, "")) : 0,
        costHigh: costMatch ? parseInt(costMatch[2].replace(/,/g, "")) : 0,
        recommendation: recMatch?.[1]?.trim() || "",
      };
      setFindings(prev => [...prev, newFinding]);
    }
  }

  // ===== Photo Functions =====
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        const mediaType = file.type || "image/jpeg";
        setPendingImages(prev => [...prev, {
          data: base64,
          mediaType,
          preview: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = "";
  }

  function removePendingImage(index: number) {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }

  // ===== Voice Functions =====
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function transcribeAudio(blob: Blob) {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("/api/snitch-mitch/voice/transcribe", {
        method: "POST",
        body: formData,
      });

      const { text } = await res.json();
      if (text) {
        // Send transcribed text as a chat message
        sendMessage(text, pendingImages.length > 0 ? pendingImages : undefined);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function speakText(text: string) {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      const res = await fetch("/api/snitch-mitch/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };

      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  }

  // ===== Inspection Wizard Functions =====
  function startFullInspection() {
    setInspectionMode("full");
    setShowWizard(true);
    setCurrentAreaIndex(0);
    setCompletedAreas([]);
    const startMsg = propertyAddress
      ? `I want to do a full home inspection for the property at ${propertyAddress}.`
      : "I want to do a full home inspection.";
    sendMessage(startMsg);
  }

  function startQuickInspection() {
    setInspectionMode("quick");
    sendMessage("I have a specific issue I want to look at.");
  }

  function moveToArea(areaId: string) {
    const idx = inspectionOrder.indexOf(areaId);
    if (idx >= 0) {
      // Mark current area as completed
      const currentId = inspectionOrder[currentAreaIndex];
      if (currentId && !completedAreas.includes(currentId)) {
        setCompletedAreas(prev => [...prev, currentId]);
      }
      setCurrentAreaIndex(idx);
      const area = INSPECTION_AREAS.find(a => a.id === areaId);
      sendMessage(`Let's move on to the ${area?.name}.`);
    }
  }

  function completeCurrentArea() {
    const currentId = inspectionOrder[currentAreaIndex];
    if (!completedAreas.includes(currentId)) {
      setCompletedAreas(prev => [...prev, currentId]);
    }
    if (currentAreaIndex < inspectionOrder.length - 1) {
      setCurrentAreaIndex(prev => prev + 1);
      const nextArea = INSPECTION_AREAS.find(a => a.id === inspectionOrder[currentAreaIndex + 1]);
      sendMessage(`I'm done with this area. Let's move on to the ${nextArea?.name}.`);
    } else {
      sendMessage("I've gone through all the areas. Can you give me a summary of everything you found?");
    }
  }

  // ===== Report Functions =====
  async function downloadReport() {
    const { generateReport } = await import("@/lib/snitch-mitch/report-builder");

    // Build summary from last assistant message
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

    const report: InspectionReport = {
      propertyAddress: propertyAddress || "Not specified",
      inspectionDate: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      inspectorSummary: lastAssistantMsg?.content.slice(0, 500) || "Inspection completed.",
      findings,
    };

    await generateReport(report);
  }

  // ===== Keyboard handler =====
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input, pendingImages.length > 0 ? pendingImages : undefined);
    }
  }

  // ===== Render =====
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-cream">
      {/* Header */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a href="/" className="text-white/60 hover:text-white text-sm">← Tools</a>
          <div>
            <h1 className="text-lg font-display font-bold">
              🔍 Snitch Mitch
            </h1>
            <p className="text-xs text-white/60">The Inspector Who Can&apos;t Hold a Secret</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              voiceEnabled ? "bg-rust text-white" : "bg-white/10 text-white/60 hover:text-white"
            }`}
            title={voiceEnabled ? "Voice responses ON" : "Voice responses OFF"}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>

          {/* Wizard toggle */}
          {inspectionMode === "full" && (
            <button
              onClick={() => setShowWizard(!showWizard)}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white"
            >
              {showWizard ? "Hide Guide" : "Show Guide"}
            </button>
          )}

          {/* Report button */}
          {findings.length > 0 && (
            <button
              onClick={() => setShowReportPanel(!showReportPanel)}
              className="text-sm px-3 py-1.5 rounded-lg bg-gold text-white font-semibold"
            >
              📋 {findings.length} Finding{findings.length !== 1 ? "s" : ""}
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Sign out"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Wizard Sidebar */}
        {showWizard && inspectionMode === "full" && (
          <aside className="w-64 bg-white border-r overflow-y-auto shrink-0 hidden md:block">
            <div className="p-4">
              <h3 className="font-bold text-navy text-sm mb-1">Inspection Progress</h3>
              <div className="text-xs text-gray-500 mb-4">
                {completedAreas.length} of {inspectionOrder.length} areas
              </div>

              {/* Property address */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Property address..."
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-rust"
                />
              </div>

              {/* Area list */}
              <div className="space-y-1">
                {inspectionOrder.map((areaId, idx) => {
                  const area = INSPECTION_AREAS.find(a => a.id === areaId);
                  if (!area) return null;
                  const isCompleted = completedAreas.includes(areaId);
                  const isCurrent = idx === currentAreaIndex;

                  return (
                    <button
                      key={areaId}
                      onClick={() => moveToArea(areaId)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        isCurrent
                          ? "bg-rust/10 text-rust font-semibold border border-rust/20"
                          : isCompleted
                          ? "bg-sage/10 text-sage-light"
                          : "hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <span>{area.icon}</span>
                      <span className="flex-1">{area.name}</span>
                      {isCompleted && <span className="text-sage">✓</span>}
                      {isCurrent && <span className="text-rust text-xs">●</span>}
                    </button>
                  );
                })}
              </div>

              {/* Complete area button */}
              <button
                onClick={completeCurrentArea}
                className="w-full mt-4 bg-rust text-white text-sm py-2 rounded-lg font-semibold hover:bg-rust-dark transition-colors"
              >
                Done with Area →
              </button>
            </div>
          </aside>
        )}

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 chat-scroll">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-navy text-white rounded-br-md"
                        : "bg-white text-gray-800 shadow-sm rounded-bl-md"
                    }`}
                  >
                    {/* Show images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={img.preview}
                            alt="Uploaded"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}

                    {/* Message content */}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return <strong key={i}>{part.slice(2, -2)}</strong>;
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    </div>

                    {/* Speak button for assistant messages */}
                    {msg.role === "assistant" && msg.id !== "greeting" && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="mt-2 text-xs text-gray-400 hover:text-rust transition-colors"
                        title="Listen to this response"
                      >
                        {isSpeaking ? "⏹ Stop" : "🔊 Listen"}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl px-4 py-3 shadow-sm rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-rust rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Mode Selection (shown when no mode selected) */}
          {inspectionMode === "none" && messages.length === 1 && (
            <div className="px-4 pb-2">
              <div className="max-w-3xl mx-auto flex gap-3">
                <button
                  onClick={() => {
                    setInspectionMode("full");
                    setShowWizard(true);
                  }}
                  className="flex-1 bg-white rounded-xl p-4 border-2 border-transparent hover:border-rust transition-all text-left shadow-sm"
                >
                  <div className="text-2xl mb-2">🏠</div>
                  <div className="font-semibold text-navy text-sm">Full Home Inspection</div>
                  <div className="text-xs text-gray-500 mt-1">Room-by-room walkthrough</div>
                </button>
                <button
                  onClick={startQuickInspection}
                  className="flex-1 bg-white rounded-xl p-4 border-2 border-transparent hover:border-rust transition-all text-left shadow-sm"
                >
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-semibold text-navy text-sm">Quick Situation</div>
                  <div className="text-xs text-gray-500 mt-1">Look at one specific issue</div>
                </button>
              </div>
            </div>
          )}

          {/* Full Inspection Start (address + go) */}
          {inspectionMode === "full" && messages.length === 1 && (
            <div className="px-4 pb-2">
              <div className="max-w-3xl mx-auto bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm font-semibold text-navy mb-2">Property Address (optional)</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="123 Main St, City, State"
                    value={propertyAddress}
                    onChange={e => setPropertyAddress(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-rust"
                  />
                  <button
                    onClick={startFullInspection}
                    className="bg-rust text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-rust-dark transition-colors"
                  >
                    Start Inspection →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending Images Preview */}
          {pendingImages.length > 0 && (
            <div className="px-4 pb-2">
              <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img.preview} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      onClick={() => removePendingImage(i)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t bg-white px-4 py-3 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2">
                {/* Photo buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-rust transition-colors rounded-lg hover:bg-gray-50"
                    title="Upload photo"
                  >
                    📷
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-rust transition-colors rounded-lg hover:bg-gray-50 md:hidden"
                    title="Take photo"
                  >
                    📸
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {/* Text input */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Type a message or use voice..."}
                  rows={1}
                  disabled={isRecording || isTranscribing}
                  className="flex-1 px-4 py-2.5 border rounded-xl text-sm resize-none focus:outline-none focus:border-rust disabled:bg-gray-50 max-h-32"
                  style={{ minHeight: "42px" }}
                />

                {/* Voice button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing || isStreaming}
                  className={`p-2.5 rounded-xl transition-all ${
                    isRecording
                      ? "bg-red-500 text-white animate-pulse-ring"
                      : isTranscribing
                      ? "bg-gray-200 text-gray-400"
                      : "bg-gray-100 text-gray-500 hover:bg-rust hover:text-white"
                  }`}
                  title={isRecording ? "Stop recording" : "Start voice input"}
                >
                  {isRecording ? "⏹" : isTranscribing ? "..." : "🎙️"}
                </button>

                {/* Send button */}
                <button
                  onClick={() => sendMessage(input, pendingImages.length > 0 ? pendingImages : undefined)}
                  disabled={isStreaming || (!input.trim() && pendingImages.length === 0)}
                  className="p-2.5 bg-rust text-white rounded-xl hover:bg-rust-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Report Panel */}
        {showReportPanel && (
          <aside className="w-80 bg-white border-l overflow-y-auto shrink-0 hidden md:block">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-navy text-sm">Inspection Findings</h3>
                <button onClick={() => setShowReportPanel(false)} className="text-gray-400 hover:text-gray-600">×</button>
              </div>

              {/* Property address for report */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Property address for report..."
                  value={propertyAddress}
                  onChange={e => setPropertyAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:border-rust"
                />
              </div>

              {/* Add finding manually */}
              <AddFindingForm onAdd={(f) => setFindings(prev => [...prev, f])} />

              {/* Findings list */}
              <div className="space-y-3 mt-4">
                {findings.map((f, i) => (
                  <div key={f.id} className="border rounded-lg p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-navy">{f.issue}</div>
                        <div className="text-gray-500 mt-1">{f.area} · {f.classification}</div>
                        <div className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.severity === "Critical" ? "bg-red-100 text-red-700" :
                          f.severity === "Major" ? "bg-orange-100 text-orange-700" :
                          f.severity === "Minor" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {f.severity}
                        </div>
                        {(f.costLow > 0 || f.costHigh > 0) && (
                          <div className="text-gray-500 mt-1">${f.costLow.toLocaleString()} — ${f.costHigh.toLocaleString()}</div>
                        )}
                      </div>
                      <button
                        onClick={() => setFindings(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-300 hover:text-red-500 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Download report */}
              {findings.length > 0 && (
                <button
                  onClick={downloadReport}
                  className="w-full mt-4 bg-navy text-white py-3 rounded-xl font-semibold text-sm hover:bg-navy-dark transition-colors"
                >
                  📄 Download PDF Report
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
      </div>
    </AuthGuard>
  );
}

// ===== Add Finding Form (sub-component) =====
function AddFindingForm({ onAdd }: { onAdd: (f: Finding) => void }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [area, setArea] = useState("Exterior");
  const [classification, setClassification] = useState<"Code Issue" | "Repair Issue">("Repair Issue");
  const [severity, setSeverity] = useState<"Critical" | "Major" | "Minor" | "Cosmetic">("Minor");
  const [costLow, setCostLow] = useState("");
  const [costHigh, setCostHigh] = useState("");
  const [recommendation, setRecommendation] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-xs text-rust font-semibold py-2 border border-dashed border-rust/30 rounded-lg hover:bg-rust/5 transition-colors"
      >
        + Add Finding Manually
      </button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 text-xs">
      <input
        type="text"
        placeholder="Issue description"
        value={issue}
        onChange={e => setIssue(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-xs"
      />
      <select value={area} onChange={e => setArea(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
        {INSPECTION_AREAS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
      </select>
      <div className="flex gap-2">
        <select value={classification} onChange={e => setClassification(e.target.value as any)} className="flex-1 px-2 py-1.5 border rounded text-xs">
          <option value="Code Issue">Code Issue</option>
          <option value="Repair Issue">Repair Issue</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value as any)} className="flex-1 px-2 py-1.5 border rounded text-xs">
          <option value="Critical">Critical</option>
          <option value="Major">Major</option>
          <option value="Minor">Minor</option>
          <option value="Cosmetic">Cosmetic</option>
        </select>
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="Cost low" value={costLow} onChange={e => setCostLow(e.target.value)} className="flex-1 px-2 py-1.5 border rounded text-xs" />
        <input type="number" placeholder="Cost high" value={costHigh} onChange={e => setCostHigh(e.target.value)} className="flex-1 px-2 py-1.5 border rounded text-xs" />
      </div>
      <input
        type="text"
        placeholder="Recommendation"
        value={recommendation}
        onChange={e => setRecommendation(e.target.value)}
        className="w-full px-2 py-1.5 border rounded text-xs"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!issue.trim()) return;
            onAdd({
              id: Date.now().toString(),
              area,
              issue: issue.trim(),
              classification,
              severity,
              costLow: parseInt(costLow) || 0,
              costHigh: parseInt(costHigh) || 0,
              recommendation: recommendation.trim(),
            });
            setIssue("");
            setRecommendation("");
            setCostLow("");
            setCostHigh("");
            setOpen(false);
          }}
          className="flex-1 bg-rust text-white py-1.5 rounded text-xs font-semibold"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
