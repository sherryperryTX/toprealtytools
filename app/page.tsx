export default function Home() {
  const tools = [
    {
      name: "Snitch Mitch",
      tagline: "The Inspector Who Can't Hold a Secret",
      description: "AI-powered home inspection assistant. Walk through a full home inspection room by room, or get help with a single issue. Photo analysis, voice chat, and professional PDF reports.",
      href: "/snitch-mitch",
      icon: "🔍",
      status: "live",
      gradient: "from-rust via-rust-dark to-orange-900",
      badge: "bg-white text-rust",
    },
    {
      name: "AI Appraiser",
      tagline: "Your Virtual Appraisal Partner",
      description: "Work alongside an AI appraiser to pull comparables, make adjustments, and produce professional property appraisals with full analysis.",
      href: "/appraiser",
      icon: "📊",
      status: "coming-soon",
      gradient: "from-pop via-indigo-600 to-indigo-800",
      badge: "bg-white/20 text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-display font-extrabold text-navy">Top Realty</span>
            <span className="text-2xl font-display font-extrabold text-rust">Tools</span>
          </div>
          <span className="text-sm text-gray-400 hidden sm:block">AI-Powered Tools for Real Estate Pros</span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-white py-24">
        {/* Background gradient blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-pop/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-rust/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan/10 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10">
          <div className="inline-block bg-white/10 text-white/80 text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            AI-Powered Real Estate Tools
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold mb-6 tracking-tight">
            Work Smarter.<br />
            <span className="bg-gradient-to-r from-rust-light via-rust to-gold bg-clip-text text-transparent">Close Faster.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
            Professional AI tools designed specifically for real estate agents.
            Inspections, appraisals, and more — powered by the latest AI.
          </p>
          <a href="#tools" className="inline-flex items-center gap-2 bg-rust text-white px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-rust-dark transition-all hover:shadow-xl hover:shadow-rust/25 hover:-translate-y-0.5">
            Explore Tools
            <span className="text-white/80">↓</span>
          </a>
        </div>
      </section>

      {/* Tools Grid */}
      <section id="tools" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-display font-extrabold text-navy mb-3">Our Tools</h2>
          <p className="text-gray-400 text-lg">Built to save you time and make you look like a pro.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {tools.map(tool => (
            <a
              key={tool.name}
              href={tool.status === "live" ? tool.href : undefined}
              className={`bg-white rounded-3xl shadow-sm overflow-hidden group transition-all ${
                tool.status === "live" ? "hover:shadow-2xl hover:-translate-y-1 cursor-pointer" : "opacity-75"
              }`}
            >
              {/* Card Header */}
              <div className={`bg-gradient-to-br ${tool.gradient} text-white p-8 relative`}>
                <div className="text-5xl mb-4 drop-shadow-lg">{tool.icon}</div>
                <h3 className="text-2xl font-display font-extrabold mb-1">{tool.name}</h3>
                <p className="text-white/70 text-sm font-medium">{tool.tagline}</p>
                {tool.status === "coming-soon" && (
                  <span className={`absolute top-4 right-4 ${tool.badge} text-xs font-bold px-3 py-1 rounded-full`}>
                    Coming Soon
                  </span>
                )}
                {tool.status === "live" && (
                  <span className={`absolute top-4 right-4 ${tool.badge} text-xs font-bold px-3 py-1 rounded-full`}>
                    Live
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="p-6">
                <p className="text-gray-500 mb-5 leading-relaxed">{tool.description}</p>
                {tool.status === "live" ? (
                  <span className="inline-flex items-center gap-1.5 text-rust font-semibold group-hover:gap-3 transition-all">
                    Launch Tool <span>→</span>
                  </span>
                ) : (
                  <span className="text-gray-300 font-semibold">
                    Stay Tuned
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/40 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} TopRealtyTools.com — Built for real estate professionals.</p>
        </div>
      </footer>
    </div>
  );
}
