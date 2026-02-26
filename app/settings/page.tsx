"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/AuthGuard";
import { supabase } from "@/lib/supabase";
import { getUserApiKeys, saveUserApiKeys, clearUserApiKeys, hasUserApiKeys, getUsageCount, FREE_LIMIT } from "@/lib/usage";

export default function SettingsPage() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Load existing keys
    const keys = getUserApiKeys();
    if (keys.anthropicKey) setAnthropicKey(keys.anthropicKey);
    if (keys.openaiKey) setOpenaiKey(keys.openaiKey);
    setHasKeys(hasUserApiKeys());

    // Get usage count
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email || "");
        getUsageCount(session.user.id).then(setUsageCount);
      }
    });
  }, []);

  const handleSave = () => {
    saveUserApiKeys({ anthropicKey: anthropicKey || undefined, openaiKey: openaiKey || undefined });
    setHasKeys(hasUserApiKeys());
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    clearUserApiKeys();
    setAnthropicKey("");
    setOpenaiKey("");
    setHasKeys(false);
    setTestResult(null);
  };

  const handleTestKey = async () => {
    if (!anthropicKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey }),
      });
      const data = await resp.json();
      setTestResult(data.success
        ? { success: true, message: "Your Anthropic API key is working!" }
        : { success: false, message: data.error || "Invalid key. Please check and try again." }
      );
    } catch {
      setTestResult({ success: false, message: "Could not test the key. Please try again." });
    }
    setTesting(false);
  };

  const remaining = Math.max(0, FREE_LIMIT - usageCount);
  const pct = Math.min(100, (usageCount / FREE_LIMIT) * 100);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-cream">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-rust hover:text-rust-dark transition-colors text-sm font-medium">← Back to Tools</a>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-display font-extrabold text-navy">Top Realty</span>
                <span className="text-2xl font-display font-extrabold text-rust">Tools</span>
              </div>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400 hover:text-navy transition-colors font-medium">
              Sign Out
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
          <div>
            <h1 className="text-3xl font-display font-extrabold text-navy mb-2">Account Settings</h1>
            <p className="text-gray-400">{userEmail}</p>
          </div>

          {/* Usage Meter */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold text-navy mb-4">Your Usage This Month</h2>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{usageCount} of {FREE_LIMIT} free messages used</span>
              <span className="text-sm font-semibold text-navy">{remaining} remaining</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-sage"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {hasKeys && (
              <p className="text-sm text-sage mt-3 font-medium">
                You&apos;re using your own API keys — unlimited usage!
              </p>
            )}
            {!hasKeys && remaining === 0 && (
              <p className="text-sm text-red-500 mt-3 font-medium">
                Free limit reached. Add your own API keys below to continue.
              </p>
            )}
          </div>

          {/* API Keys */}
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h2 className="font-bold text-navy mb-1">Your API Keys</h2>
              <p className="text-sm text-gray-400">
                Your keys are stored locally on your device only — we never see or save them on our servers.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Anthropic API Key <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Required for all AI chat and photo analysis features</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                OpenAI API Key <span className="text-gray-300">(optional)</span>
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all font-mono text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Only needed for voice features (speech-to-text and text-to-speech)</p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-navy text-white py-3 rounded-xl font-semibold hover:bg-navy-dark transition-colors">
                {saved ? "Saved!" : "Save Keys"}
              </button>
              <button onClick={handleTestKey} disabled={!anthropicKey || testing} className="px-6 py-3 bg-rust text-white rounded-xl font-semibold hover:bg-rust-dark transition-colors disabled:opacity-50">
                {testing ? "Testing..." : "Test Key"}
              </button>
              {hasKeys && (
                <button onClick={handleClear} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                  Clear
                </button>
              )}
            </div>

            {testResult && (
              <div className={`px-4 py-3 rounded-xl text-sm ${testResult.success ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {testResult.message}
              </div>
            )}
          </div>

          {/* How to get API keys */}
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
            <h2 className="font-bold text-navy text-lg">How to Get Your API Keys</h2>
            <p className="text-sm text-gray-500">
              API keys are separate from a regular ChatGPT or Claude subscription.
              You&apos;ll need to create developer accounts — it only takes a few minutes and anyone can do it.
              You only pay for what you use (typically a few cents per conversation).
            </p>

            {/* Anthropic */}
            <div className="border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🟣</span>
                <h3 className="font-bold text-navy">Anthropic (Claude) — Required</h3>
              </div>
              <p className="text-sm text-gray-500">Powers all AI chat and photo analysis in both Snitch Mitch and AI Appraiser.</p>
              <ol className="text-sm text-gray-600 space-y-2 ml-4">
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">1.</span>
                  <span>Go to <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-rust font-semibold hover:underline">console.anthropic.com</a> and create an account</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">2.</span>
                  <span>Add a payment method (Settings → Billing → Add payment)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">3.</span>
                  <span>Add credits — $5 will last you a long time for typical usage</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">4.</span>
                  <span>Go to <strong>API Keys</strong> → <strong>Create Key</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">5.</span>
                  <span>Copy the key (starts with <code className="bg-gray-100 px-1 rounded">sk-ant-</code>) and paste it above</span>
                </li>
              </ol>
              <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                Typical cost: $0.01–$0.05 per chat message, $0.03–$0.10 per photo analysis
              </div>
            </div>

            {/* OpenAI */}
            <div className="border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🟢</span>
                <h3 className="font-bold text-navy">OpenAI — Optional (for voice features)</h3>
              </div>
              <p className="text-sm text-gray-500">Only needed if you want voice input/output in Snitch Mitch. Text chat and photo analysis work without it.</p>
              <ol className="text-sm text-gray-600 space-y-2 ml-4">
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">1.</span>
                  <span>Go to <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-rust font-semibold hover:underline">platform.openai.com</a> and create an account</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">2.</span>
                  <span>Add a payment method under Billing</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">3.</span>
                  <span>Go to <strong>API Keys</strong> → <strong>Create new secret key</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-navy shrink-0">4.</span>
                  <span>Copy the key (starts with <code className="bg-gray-100 px-1 rounded">sk-</code>) and paste it above</span>
                </li>
              </ol>
              <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                Typical cost: $0.006/min for voice transcription, $0.015 per 1,000 characters for voice output
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
              <strong className="text-navy">Is this safe?</strong> Your API keys are stored only in your browser&apos;s local storage on your device.
              They are sent directly to Anthropic/OpenAI when you use the tools — our servers never store them.
              You can clear them anytime from this page.
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
