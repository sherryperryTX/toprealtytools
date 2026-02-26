"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import AuthGuard from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";
import { APPRAISER_GREETING } from "@/lib/appraiser/system-prompt";
import {
  type SubjectProperty,
  type ComparableProperty,
  type AdjustmentSet,
  type AdjustmentKey,
  type Reconciliation,
  ADJUSTMENT_CATEGORIES,
  EMPTY_SUBJECT,
  createEmptyComp,
} from "@/lib/appraiser/types";
import { calculateAutoAdjustments, buildAdjustmentSet } from "@/lib/appraiser/adjustments";

// ===== Types =====
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: { data: string; mediaType: string; preview: string }[];
  timestamp: Date;
}

type Step = "subject" | "comps" | "adjustments" | "reconciliation";

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: "subject", label: "Subject Property", icon: "🏠" },
  { key: "comps", label: "Comparables", icon: "🏘️" },
  { key: "adjustments", label: "Adjustments", icon: "📐" },
  { key: "reconciliation", label: "Reconciliation", icon: "💰" },
];

export default function AppraiserPage() {
  // Steps
  const [currentStep, setCurrentStep] = useState<Step>("subject");

  // Subject property
  const [subject, setSubject] = useState<SubjectProperty>({ ...EMPTY_SUBJECT });

  // Comparables
  const [comps, setComps] = useState<ComparableProperty[]>([createEmptyComp()]);

  // Adjustments
  const [adjustmentSets, setAdjustmentSets] = useState<AdjustmentSet[]>([]);

  // Reconciliation
  const [reconciliation, setReconciliation] = useState<Reconciliation>({
    compWeights: {},
    finalValue: 0,
    valueRange: { low: 0, high: 0 },
    effectiveDate: new Date().toISOString().split("T")[0],
    comments: "",
  });

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "assistant", content: APPRAISER_GREETING, timestamp: new Date() },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Photo upload for chat
  const [pendingImages, setPendingImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Build context for AI =====
  const buildAppraisalContext = useCallback(() => {
    const parts: string[] = [];

    // Subject
    if (subject.address) {
      parts.push(`Subject Property: ${subject.address}, ${subject.city} ${subject.state} ${subject.zip}`);
      parts.push(`Type: ${subject.propertyType} | Year: ${subject.yearBuilt} | GLA: ${subject.gla} sqft | Lot: ${subject.lotSize} sqft`);
      parts.push(`Beds: ${subject.bedrooms} | Baths: ${subject.bathrooms} | Garage: ${subject.garageType} (${subject.garageSpaces})`);
      parts.push(`Condition: ${subject.condition} | Quality: ${subject.quality} | Pool: ${subject.pool ? "Yes" : "No"}`);
      if (subject.basementSqFt) parts.push(`Basement: ${subject.basementSqFt} sqft (${subject.basementFinished ? "Finished" : "Unfinished"})`);
    }

    // Comps
    const validComps = comps.filter(c => c.address && c.salePrice);
    if (validComps.length > 0) {
      parts.push("\nComparables:");
      validComps.forEach((c, i) => {
        parts.push(`Comp ${i + 1}: ${c.address} | Sale: $${Number(c.salePrice).toLocaleString()} (${c.saleDate}) | GLA: ${c.gla} sqft | Beds: ${c.bedrooms} Baths: ${c.bathrooms}`);
      });
    }

    // Adjustments
    if (adjustmentSets.length > 0) {
      parts.push("\nAdjustments:");
      adjustmentSets.forEach((as, i) => {
        parts.push(`Comp ${i + 1}: Net Adj: $${as.netAdjustment.toLocaleString()} | Adjusted Price: $${as.adjustedPrice.toLocaleString()}`);
      });
    }

    parts.push(`\nCurrent Step: ${currentStep}`);
    return parts.join("\n");
  }, [subject, comps, adjustmentSets, currentStep]);

  // ===== Chat send =====
  const sendMessage = useCallback(async (text: string, images?: typeof pendingImages) => {
    if (!text.trim() && (!images || images.length === 0)) return;
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      images,
      timestamp: new Date(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setPendingImages([]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const chatHistory = [...messages.filter(m => m.id !== "greeting"), userMsg].map(m => ({
        role: m.role,
        content: m.content,
        images: m.images?.map(img => ({ data: img.data, mediaType: img.mediaType })),
      }));

      const resp = await fetch("/api/appraiser/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          appraisalContext: buildAppraisalContext(),
        }),
        signal: controller.signal,
      });

      if (!resp.ok) throw new Error("Chat request failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && !line.includes("[DONE]")) {
            try {
              const { text: t } = JSON.parse(line.slice(6));
              if (t) {
                setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + t } : m));
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: "Sorry, something went wrong. Please try again." } : m));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, isStreaming, buildAppraisalContext]);

  // ===== Photo handling =====
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPendingImages(prev => [...prev, {
          data: base64,
          mediaType: file.type || "image/jpeg",
          preview: reader.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // ===== Auto-calculate adjustments =====
  const recalcAdjustments = useCallback(() => {
    const validComps = comps.filter(c => c.address && c.salePrice);
    if (validComps.length === 0) return;

    const avgPriceSqFt = validComps.reduce((sum, c) => {
      const price = typeof c.salePrice === "number" ? c.salePrice : 0;
      const gla = typeof c.gla === "number" ? c.gla : 1;
      return sum + (gla > 0 ? price / gla : 0);
    }, 0) / validComps.length;

    const newSets = validComps.map(comp => {
      // Preserve existing manual adjustments if they exist
      const existing = adjustmentSets.find(a => a.compId === comp.compId);
      const auto = calculateAutoAdjustments(subject, comp, avgPriceSqFt);
      const adjs = existing ? existing.adjustments : auto;
      return buildAdjustmentSet(comp, adjs);
    });

    setAdjustmentSets(newSets);

    // Auto-set equal weights
    const weights: Record<string, number> = {};
    const w = Math.round(100 / validComps.length);
    validComps.forEach((c, i) => {
      weights[c.compId] = i === validComps.length - 1 ? 100 - w * (validComps.length - 1) : w;
    });
    setReconciliation(prev => {
      const adjustedPrices = newSets.map(s => s.adjustedPrice);
      const weighted = newSets.reduce((sum, s) => sum + s.adjustedPrice * ((weights[s.compId] || 0) / 100), 0);
      return {
        ...prev,
        compWeights: { ...prev.compWeights, ...weights },
        finalValue: Math.round(weighted),
        valueRange: {
          low: Math.min(...adjustedPrices),
          high: Math.max(...adjustedPrices),
        },
      };
    });
  }, [comps, subject, adjustmentSets]);

  // ===== Ask AI for adjustment suggestions =====
  const askAISuggestion = () => {
    const validComps = comps.filter(c => c.address && c.salePrice);
    if (validComps.length === 0) return;
    sendMessage(
      `Please review my subject property and ${validComps.length} comparable(s) and suggest specific dollar adjustments for each category. Consider the local market conditions and explain your reasoning for each adjustment. Format your response clearly by comp number.`
    );
  };

  // ===== Download report =====
  const downloadReport = async () => {
    const { generateAppraisalReport } = await import("@/lib/appraiser/report-builder");
    generateAppraisalReport({
      subject,
      comparables: comps.filter(c => c.address && c.salePrice),
      adjustments: adjustmentSets,
      reconciliation,
      appraiserName: "AI Appraiser Report",
      reportDate: new Date().toLocaleDateString(),
    });
  };

  // ===== Step navigation =====
  const goToStep = (step: Step) => {
    if (step === "adjustments" && comps.filter(c => c.address && c.salePrice).length > 0) {
      recalcAdjustments();
    }
    if (step === "reconciliation" && adjustmentSets.length > 0) {
      // Recalculate final value
      const weighted = adjustmentSets.reduce((sum, s) => {
        const w = (reconciliation.compWeights[s.compId] || 0) / 100;
        return sum + s.adjustedPrice * w;
      }, 0);
      setReconciliation(prev => ({ ...prev, finalValue: Math.round(weighted) }));
    }
    setCurrentStep(step);
  };

  // ===== Render helpers =====
  const updateSubject = (key: keyof SubjectProperty, value: any) => {
    setSubject(prev => ({ ...prev, [key]: value }));
  };

  const updateComp = (compId: string, key: keyof ComparableProperty, value: any) => {
    setComps(prev => prev.map(c => c.compId === compId ? { ...c, [key]: value } : c));
  };

  const updateAdjustment = (compId: string, key: AdjustmentKey, value: number) => {
    setAdjustmentSets(prev => prev.map(as => {
      if (as.compId !== compId) return as;
      const newAdjs = { ...as.adjustments, [key]: value };
      const comp = comps.find(c => c.compId === compId);
      return comp ? buildAdjustmentSet(comp, newAdjs) : as;
    }));
  };

  const formatCurrency = (n: number) => {
    if (n === 0) return "$0";
    const prefix = n < 0 ? "-" : "+";
    return n < 0 ? `-$${Math.abs(n).toLocaleString()}` : `+$${n.toLocaleString()}`;
  };

  // ===== RENDER =====
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-cream">
        {/* Header */}
        <header className="bg-navy text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <a href="/" className="text-white/60 hover:text-white text-sm">← Tools</a>
            <div>
              <h1 className="text-lg font-display font-bold">📊 AI Appraiser</h1>
              <p className="text-xs text-white/60">Your Virtual Appraisal Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChat(!showChat)}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white"
            >
              {showChat ? "Hide Chat" : "Show Chat"}
            </button>
            {adjustmentSets.length > 0 && (
              <button
                onClick={downloadReport}
                className="text-sm px-3 py-1.5 rounded-lg bg-gold text-white font-semibold"
              >
                📄 Download Report
              </button>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Step Navigation */}
        <div className="bg-white border-b px-4 py-2 flex items-center gap-1 overflow-x-auto shrink-0">
          {STEPS.map((step, i) => (
            <button
              key={step.key}
              onClick={() => goToStep(step.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                currentStep === step.key
                  ? "bg-navy text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <span>{step.icon}</span>
              <span className="hidden sm:inline">{step.label}</span>
              {i < STEPS.length - 1 && <span className="text-gray-300 ml-2 hidden sm:inline">→</span>}
            </button>
          ))}
        </div>

        {/* Main content + chat */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — forms */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Step 1: Subject Property */}
            {currentStep === "subject" && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy mb-1">Subject Property</h2>
                  <p className="text-gray-400 text-sm">Enter the details of the property being appraised.</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-navy text-sm">Location</h3>
                  <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Street Address" value={subject.address} onChange={e => updateSubject("address", e.target.value)} />
                  <div className="grid grid-cols-3 gap-3">
                    <input className="px-3 py-2 border rounded-lg text-sm" placeholder="City" value={subject.city} onChange={e => updateSubject("city", e.target.value)} />
                    <input className="px-3 py-2 border rounded-lg text-sm" placeholder="State" value={subject.state} onChange={e => updateSubject("state", e.target.value)} />
                    <input className="px-3 py-2 border rounded-lg text-sm" placeholder="ZIP" value={subject.zip} onChange={e => updateSubject("zip", e.target.value)} />
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-navy text-sm">Property Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Type</label>
                      <select className="w-full px-3 py-2 border rounded-lg text-sm" value={subject.propertyType} onChange={e => updateSubject("propertyType", e.target.value)}>
                        <option value="SFR">Single Family</option>
                        <option value="Condo">Condo</option>
                        <option value="Townhouse">Townhouse</option>
                        <option value="Multi-Family">Multi-Family</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Year Built</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="2005" value={subject.yearBuilt} onChange={e => updateSubject("yearBuilt", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">GLA (sq ft)</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="2000" value={subject.gla} onChange={e => updateSubject("gla", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Lot Size (sq ft)</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="7500" value={subject.lotSize} onChange={e => updateSubject("lotSize", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Bedrooms</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="3" value={subject.bedrooms} onChange={e => updateSubject("bedrooms", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Bathrooms</label>
                      <input type="number" step="0.5" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="2" value={subject.bathrooms} onChange={e => updateSubject("bathrooms", e.target.value ? parseFloat(e.target.value) : "")} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-navy text-sm">Features & Condition</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Condition</label>
                      <select className="w-full px-3 py-2 border rounded-lg text-sm" value={subject.condition} onChange={e => updateSubject("condition", e.target.value)}>
                        <option value="">Select...</option>
                        <option value="C1">C1 - New</option>
                        <option value="C2">C2 - Like New</option>
                        <option value="C3">C3 - Well Maintained</option>
                        <option value="C4">C4 - Average</option>
                        <option value="C5">C5 - Fair</option>
                        <option value="C6">C6 - Poor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Quality</label>
                      <select className="w-full px-3 py-2 border rounded-lg text-sm" value={subject.quality} onChange={e => updateSubject("quality", e.target.value)}>
                        <option value="">Select...</option>
                        <option value="Q1">Q1 - Luxury</option>
                        <option value="Q2">Q2 - High Quality</option>
                        <option value="Q3">Q3 - Above Average</option>
                        <option value="Q4">Q4 - Average</option>
                        <option value="Q5">Q5 - Economy</option>
                        <option value="Q6">Q6 - Basic</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Garage</label>
                      <select className="w-full px-3 py-2 border rounded-lg text-sm" value={subject.garageType} onChange={e => updateSubject("garageType", e.target.value)}>
                        <option value="None">None</option>
                        <option value="Attached">Attached</option>
                        <option value="Detached">Detached</option>
                        <option value="Carport">Carport</option>
                      </select>
                    </div>
                    {subject.garageType !== "None" && (
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Garage Spaces</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="2" value={subject.garageSpaces} onChange={e => updateSubject("garageSpaces", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Basement (sq ft)</label>
                      <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0" value={subject.basementSqFt} onChange={e => updateSubject("basementSqFt", e.target.value ? parseInt(e.target.value) : "")} />
                    </div>
                    {subject.basementSqFt && (
                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" checked={subject.basementFinished} onChange={e => updateSubject("basementFinished", e.target.checked)} className="rounded" />
                        <label className="text-sm text-gray-600">Finished Basement</label>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" checked={subject.pool} onChange={e => updateSubject("pool", e.target.checked)} className="rounded" />
                      <label className="text-sm text-gray-600">Pool</label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">View</label>
                    <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Lake view, City view, None" value={subject.view} onChange={e => updateSubject("view", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Notes</label>
                    <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} placeholder="Any additional notes..." value={subject.notes} onChange={e => updateSubject("notes", e.target.value)} />
                  </div>
                </div>

                <button onClick={() => goToStep("comps")} className="w-full bg-navy text-white py-3 rounded-xl font-semibold hover:bg-navy-dark transition-colors">
                  Next: Add Comparables →
                </button>
              </div>
            )}

            {/* Step 2: Comparables */}
            {currentStep === "comps" && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy mb-1">Comparable Sales</h2>
                  <p className="text-gray-400 text-sm">Add 1-6 comparable properties. The more detail you provide, the better the analysis.</p>
                </div>

                {comps.map((comp, idx) => (
                  <div key={comp.compId} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-navy">Comp {idx + 1}</h3>
                      {comps.length > 1 && (
                        <button onClick={() => setComps(prev => prev.filter(c => c.compId !== comp.compId))} className="text-red-400 text-xs hover:text-red-600">Remove</button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="col-span-2 md:col-span-3">
                        <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Address" value={comp.address} onChange={e => updateComp(comp.compId, "address", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Sale Price</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="350000" value={comp.salePrice} onChange={e => updateComp(comp.compId, "salePrice", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Sale Date</label>
                        <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.saleDate} onChange={e => updateComp(comp.compId, "saleDate", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Distance</label>
                        <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="0.3 mi" value={comp.distance} onChange={e => updateComp(comp.compId, "distance", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">GLA (sq ft)</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="1900" value={comp.gla} onChange={e => updateComp(comp.compId, "gla", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Lot Size</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="7000" value={comp.lotSize} onChange={e => updateComp(comp.compId, "lotSize", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Year Built</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="2003" value={comp.yearBuilt} onChange={e => updateComp(comp.compId, "yearBuilt", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Beds</label>
                        <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.bedrooms} onChange={e => updateComp(comp.compId, "bedrooms", e.target.value ? parseInt(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Baths</label>
                        <input type="number" step="0.5" className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.bathrooms} onChange={e => updateComp(comp.compId, "bathrooms", e.target.value ? parseFloat(e.target.value) : "")} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Condition</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.condition} onChange={e => updateComp(comp.compId, "condition", e.target.value)}>
                          <option value="">--</option>
                          <option value="C1">C1</option><option value="C2">C2</option><option value="C3">C3</option>
                          <option value="C4">C4</option><option value="C5">C5</option><option value="C6">C6</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Quality</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.quality} onChange={e => updateComp(comp.compId, "quality", e.target.value)}>
                          <option value="">--</option>
                          <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option>
                          <option value="Q4">Q4</option><option value="Q5">Q5</option><option value="Q6">Q6</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Garage</label>
                        <select className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.garageType} onChange={e => updateComp(comp.compId, "garageType", e.target.value)}>
                          <option value="None">None</option><option value="Attached">Attached</option>
                          <option value="Detached">Detached</option><option value="Carport">Carport</option>
                        </select>
                      </div>
                      {comp.garageType !== "None" && (
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Spaces</label>
                          <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={comp.garageSpaces} onChange={e => updateComp(comp.compId, "garageSpaces", e.target.value ? parseInt(e.target.value) : "")} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-5">
                        <input type="checkbox" checked={comp.pool} onChange={e => updateComp(comp.compId, "pool", e.target.checked)} className="rounded" />
                        <label className="text-sm text-gray-600">Pool</label>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Data Source</label>
                        <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="MLS#12345" value={comp.dataSource} onChange={e => updateComp(comp.compId, "dataSource", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                {comps.length < 6 && (
                  <button onClick={() => setComps(prev => [...prev, createEmptyComp()])} className="w-full border-2 border-dashed border-gray-200 text-gray-400 py-4 rounded-2xl hover:border-navy hover:text-navy transition-colors text-sm font-medium">
                    + Add Another Comparable
                  </button>
                )}

                <div className="flex gap-3">
                  <button onClick={() => goToStep("subject")} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                    ← Back
                  </button>
                  <button onClick={() => goToStep("adjustments")} className="flex-1 bg-navy text-white py-3 rounded-xl font-semibold hover:bg-navy-dark transition-colors">
                    Next: Adjustments →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Adjustments */}
            {currentStep === "adjustments" && (
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-navy mb-1">Adjustment Grid</h2>
                    <p className="text-gray-400 text-sm">Adjust comps to the subject property. Positive = comp is inferior, Negative = comp is superior.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={recalcAdjustments} className="text-sm px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-600">
                      🔄 Auto-Calculate
                    </button>
                    <button onClick={askAISuggestion} className="text-sm px-4 py-2 bg-rust text-white rounded-lg hover:bg-rust-dark transition-colors font-medium">
                      🤖 AI Suggestions
                    </button>
                  </div>
                </div>

                {adjustmentSets.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 shadow-sm text-center text-gray-400">
                    <p className="mb-2">No valid comparables found.</p>
                    <p className="text-sm">Go back and add at least one comparable with an address and sale price.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-navy text-white">
                          <th className="text-left px-4 py-3 font-medium sticky left-0 bg-navy z-10">Category</th>
                          {adjustmentSets.map((as, i) => {
                            const comp = comps.find(c => c.compId === as.compId);
                            return (
                              <th key={as.compId} className="text-center px-4 py-3 font-medium min-w-[140px]">
                                Comp {i + 1}
                                {comp?.salePrice && (
                                  <div className="text-xs text-white/60 font-normal">${Number(comp.salePrice).toLocaleString()}</div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {ADJUSTMENT_CATEGORIES.map(cat => (
                          <tr key={cat.key} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-white">{cat.label}</td>
                            {adjustmentSets.map(as => (
                              <td key={as.compId} className="px-4 py-2 text-center">
                                <input
                                  type="number"
                                  className={`w-28 px-2 py-1 border rounded text-center text-sm ${
                                    as.adjustments[cat.key] > 0 ? "text-green-600 bg-green-50" :
                                    as.adjustments[cat.key] < 0 ? "text-red-600 bg-red-50" : ""
                                  }`}
                                  value={as.adjustments[cat.key] || ""}
                                  onChange={e => updateAdjustment(as.compId, cat.key, e.target.value ? parseInt(e.target.value) : 0)}
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                        {/* Totals */}
                        <tr className="bg-gray-50 font-semibold border-t-2">
                          <td className="px-4 py-3 sticky left-0 bg-gray-50">Net Adjustment</td>
                          {adjustmentSets.map(as => (
                            <td key={as.compId} className={`px-4 py-3 text-center ${as.netAdjustment >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(as.netAdjustment)}
                            </td>
                          ))}
                        </tr>
                        <tr className="bg-gray-50 text-xs">
                          <td className="px-4 py-1 sticky left-0 bg-gray-50 text-gray-400">Gross Adjustment</td>
                          {adjustmentSets.map(as => {
                            const comp = comps.find(c => c.compId === as.compId);
                            const price = typeof comp?.salePrice === "number" ? comp.salePrice : 1;
                            const pct = ((as.grossAdjustment / price) * 100).toFixed(1);
                            return (
                              <td key={as.compId} className={`px-4 py-1 text-center ${parseFloat(pct) > 25 ? "text-red-500" : "text-gray-400"}`}>
                                ${as.grossAdjustment.toLocaleString()} ({pct}%)
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="bg-navy text-white font-bold">
                          <td className="px-4 py-3 sticky left-0 bg-navy">Adjusted Price</td>
                          {adjustmentSets.map(as => (
                            <td key={as.compId} className="px-4 py-3 text-center">
                              ${as.adjustedPrice.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => goToStep("comps")} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                    ← Back
                  </button>
                  <button onClick={() => goToStep("reconciliation")} className="flex-1 bg-navy text-white py-3 rounded-xl font-semibold hover:bg-navy-dark transition-colors">
                    Next: Reconciliation →
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Reconciliation */}
            {currentStep === "reconciliation" && (
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold text-navy mb-1">Value Reconciliation</h2>
                  <p className="text-gray-400 text-sm">Weight each comparable and arrive at a final opinion of value.</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-navy text-sm">Comp Weights</h3>
                  <p className="text-xs text-gray-400">Assign weights (should total 100%). More weight = more similar to subject.</p>
                  {adjustmentSets.map((as, i) => {
                    const comp = comps.find(c => c.compId === as.compId);
                    return (
                      <div key={as.compId} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium text-gray-600">
                          Comp {i + 1}
                          <div className="text-xs text-gray-400">${as.adjustedPrice.toLocaleString()}</div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={reconciliation.compWeights[as.compId] || 0}
                          onChange={e => {
                            const newWeights = { ...reconciliation.compWeights, [as.compId]: parseInt(e.target.value) };
                            const weighted = adjustmentSets.reduce((sum, s) => sum + s.adjustedPrice * ((newWeights[s.compId] || 0) / 100), 0);
                            setReconciliation(prev => ({ ...prev, compWeights: newWeights, finalValue: Math.round(weighted) }));
                          }}
                          className="flex-1"
                        />
                        <span className="w-12 text-right text-sm font-bold text-navy">{reconciliation.compWeights[as.compId] || 0}%</span>
                      </div>
                    );
                  })}
                  <div className="text-xs text-gray-400 text-right">
                    Total: {Object.values(reconciliation.compWeights).reduce((s, v) => s + v, 0)}%
                  </div>
                </div>

                <div className="bg-navy rounded-2xl p-8 text-white text-center">
                  <p className="text-sm text-white/60 mb-2">Opinion of Value</p>
                  <div className="text-4xl font-display font-extrabold mb-2">${reconciliation.finalValue.toLocaleString()}</div>
                  {reconciliation.valueRange.low > 0 && (
                    <p className="text-sm text-white/50">
                      Range: ${reconciliation.valueRange.low.toLocaleString()} — ${reconciliation.valueRange.high.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Effective Date</label>
                    <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" value={reconciliation.effectiveDate} onChange={e => setReconciliation(prev => ({ ...prev, effectiveDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Reconciliation Comments</label>
                    <textarea className="w-full px-3 py-2 border rounded-lg text-sm" rows={4} placeholder="Explain your value conclusion and why certain comps were weighted more heavily..." value={reconciliation.comments} onChange={e => setReconciliation(prev => ({ ...prev, comments: e.target.value }))} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goToStep("adjustments")} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                    ← Back
                  </button>
                  <button onClick={downloadReport} className="flex-1 bg-rust text-white py-3 rounded-xl font-semibold hover:bg-rust-dark transition-colors">
                    📄 Download PDF Report
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — Chat */}
          {showChat && (
            <aside className="w-96 bg-white border-l flex flex-col shrink-0 hidden lg:flex">
              <div className="p-4 border-b">
                <h3 className="font-bold text-navy text-sm">AI Appraiser Assistant</h3>
                <p className="text-xs text-gray-400">Ask me about adjustments, methodology, or upload photos</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(msg => (
                  <div key={msg.id} className={`${msg.role === "user" ? "ml-8" : "mr-4"}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user" ? "bg-navy text-white rounded-br-md" : "bg-gray-100 text-gray-700 rounded-bl-md"
                    }`}>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {msg.images.map((img, i) => (
                            <img key={i} src={img.preview} alt="" className="w-16 h-16 rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Pending images */}
              {pendingImages.length > 0 && (
                <div className="px-4 pt-2 flex gap-2 flex-wrap">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img.preview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      <button onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Chat input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-navy" title="Upload photo">
                    📷
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage(chatInput, pendingImages.length > 0 ? pendingImages : undefined))}
                    className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    placeholder="Ask about adjustments, methodology..."
                    disabled={isStreaming}
                  />
                  <button
                    onClick={() => sendMessage(chatInput, pendingImages.length > 0 ? pendingImages : undefined)}
                    disabled={isStreaming || (!chatInput.trim() && pendingImages.length === 0)}
                    className="px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-navy-dark transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
