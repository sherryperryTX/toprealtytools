export default function AppraiserPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/" className="text-rust hover:underline text-sm">← Back to Tools</a>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold text-navy">Top Realty</span>
            <span className="text-2xl font-display font-bold text-rust">Tools</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-6">📊</div>
        <h1 className="text-4xl font-display font-bold text-navy mb-4">AI Appraiser</h1>
        <p className="text-xl text-gray-500 mb-2">Your Virtual Appraisal Partner</p>
        <p className="text-gray-500 mb-8 max-w-lg mx-auto">
          Work alongside an AI appraiser to pull comparables, make adjustments,
          and produce professional property appraisals. Photo analysis, MLS integration,
          and full adjustment calculations — all guided by AI.
        </p>

        <div className="inline-block bg-navy/10 text-navy font-semibold px-6 py-3 rounded-xl text-lg">
          Coming Soon
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl mb-2">🏘️</div>
            <div className="text-sm font-semibold text-navy">Comparable Selection</div>
            <div className="text-xs text-gray-500 mt-1">AI-guided comp search</div>
          </div>
          <div>
            <div className="text-2xl mb-2">📐</div>
            <div className="text-sm font-semibold text-navy">Smart Adjustments</div>
            <div className="text-xs text-gray-500 mt-1">Automated difference calcs</div>
          </div>
          <div>
            <div className="text-2xl mb-2">📄</div>
            <div className="text-sm font-semibold text-navy">Full Report</div>
            <div className="text-xs text-gray-500 mt-1">Professional appraisal output</div>
          </div>
        </div>
      </div>
    </div>
  );
}
