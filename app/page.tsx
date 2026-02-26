export default function Home() {
  const tools = [
    {
      name: "Snitch Mitch",
      tagline: "The Inspector Who Can't Hold a Secret",
      description: "AI-powered home inspection assistant. Walk through a full home inspection room by room, or get help with a single issue. Photo analysis, voice chat, and professional PDF reports.",
      href: "/snitch-mitch",
      icon: "🔍",
      status: "live",
      color: "from-rust to-rust-dark",
    },
    {
      name: "AI Appraiser",
      tagline: "Your Virtual Appraisal Partner",
      description: "Work alongside an AI appraiser to pull comparables, make adjustments, and produce professional property appraisals with full analysis.",
      href: "/appraiser",
      icon: "📊",
      status: "coming-soon",
      color: "from-navy to-navy-dark",
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display font-bold text-navy">Top Realty</span>
            <span className="text-2xl font-display font-bold text-rust">Tools</span>
          </div>
          <span className="text-sm text-gray-400">AI-Powered Tools for Real Estate Pros</span>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy-light to-navy text-white py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-display font-bold mb-6">
            Work Smarter.<br />
            <span className="text-rust-light">Close Faster.</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-8">
            Professional AI tools designed specifically for real estate agents.
            Inspections, appraisals, and more — powered by the latest AI technology.
          </p>
          <a href="#tools" className="inline-block bg-rust text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-rust-dark transition-colors">
            Explore Tools ↓
          </a>
        </div>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-display font-bold text-navy mb-2 text-center">Our Tools</h2>
        <p className="text-gray-500 text-center mb-12">Each tool is built to save you time and make you look like a pro.</p>

        <div className="grid md:grid-cols-2 gap-8">
          {tools.map(tool => (
            <a
              key={tool.name}
              href={tool.status === "live" ? tool.href : undefined}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden group transition-all ${
                tool.status === "live" ? "hover:shadow-xl cursor-pointer" : "opacity-80"
              }`}
            >
              {/* Card Header */}
              <div className={`bg-gradient-to-r ${tool.color} text-white p-8 relative`}>
                <div className="text-5xl mb-4">{tool.icon}</div>
                <h3 className="text-2xl font-display font-bold mb-1">{tool.name}</h3>
                <p className="text-white/80 text-sm">{tool.tagline}</p>
                {tool.status === "coming-soon" && (
                  <span className="absolute top-4 right-4 bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6">
                <p className="text-gray-600 mb-4">{tool.description}</p>
                {tool.status === "live" ? (
                  <span className="text-rust font-semibold group-hover:underline">
                    Launch Tool →
                  </span>
                ) : (
                  <span className="text-gray-400 font-semibold">
                    Stay Tuned
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/60 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} TopRealtyTools.com — Built for real estate professionals.</p>
        </div>
      </footer>
    </div>
  );
}
