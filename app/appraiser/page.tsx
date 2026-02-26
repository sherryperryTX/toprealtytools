export default function AppraiserPage() {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/" className="text-rust hover:text-rust-dark transition-colors text-sm font-medium">← Back to Tools</a>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-display font-extrabold text-navy">Top Realty</span>
            <span className="text-2xl font-display font-extrabold text-rust">Tools</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-pop/10 text-pop text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
          Coming Soon
        </div>
        <div className="text-6xl mb-6 drop-shadow-lg">📊</div>
        <h1 className="text-4xl md:text-5xl font-display font-extrabold text-navy mb-4">AI Appraiser</h1>
        <p className="text-xl text-gray-400 mb-2">Your Virtual Appraisal Partner</p>
        <p className="text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed">
          Work alongside an AI appraiser to pull comparables, make adjustments,
          and produce professional property appraisals. Photo analysis, MLS integration,
          and full adjustment calculations — all guided by AI.
        </p>

        <div className="inline-flex items-center gap-2 bg-navy text-white font-semibold px-8 py-4 rounded-2xl text-lg shadow-lg">
          <span className="w-2 h-2 bg-pop rounded-full animate-pulse" />
          In Development
        </div>

        <div className="mt-14 grid grid-cols-3 gap-8 text-center">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-3xl mb-3">🏘️</div>
            <div className="text-sm font-bold text-navy">Comparable Selection</div>
            <div className="text-xs text-gray-400 mt-1">AI-guided comp search</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-3xl mb-3">📐</div>
            <div className="text-sm font-bold text-navy">Smart Adjustments</div>
            <div className="text-xs text-gray-400 mt-1">Automated difference calcs</div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="text-3xl mb-3">📄</div>
            <div className="text-sm font-bold text-navy">Full Report</div>
            <div className="text-xs text-gray-400 mt-1">Professional appraisal output</div>
          </div>
        </div>
      </div>
    </div>
  );
}
