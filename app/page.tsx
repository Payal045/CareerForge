"use client";
import { useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import {
  ArrowRight,
  Target,
  Map,
  Trophy,
  BookOpen,
  CheckCircle,
  LogOut,
  Zap,
} from "lucide-react";
import { Login } from "../components/Login";
import { Signup } from "../components/Signup";
import { useRouter } from "next/navigation";

function App() {
  const { data: session } = useSession();
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const router = useRouter();

  const handleGetStarted = () => {
    if (session?.user) return;
    setShowSignup(true);
  };

  const handleSignIn = () => setShowLogin(true);

  // Try /search/roadmap first; if missing, fallback to /roadmap
  const openRoadmap = async (title: string, skills: string[]) => {
    // ensure guest auth if not signed in
    if (!session?.user) {
      try {
        await signIn("guest", { redirect: false });
      } catch (e) {
        console.warn("Guest sign-in failed:", e);
      }
    }

    const qp = new URLSearchParams({
      goal: title,
      skills: skills.join(","),
    }).toString();

    const tryPath = `/search/roadmap?${qp}`;
    const fallback = `/roadmap?${qp}`;

    try {
      // HEAD would be ideal but fetch HEAD on HTML routes sometimes blocked — use GET lightweight
      const resp = await fetch(tryPath, { method: "GET", headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (resp.ok) {
        router.push(tryPath);
        return;
      }
    } catch (e) {
      // proceed to fallback on error
      console.warn("Route check failed for /search/roadmap, falling back to /roadmap", e);
    }

    router.push(fallback);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">CareerForge</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
              How It Works
            </a>
            <a href="#roadmaps" className="text-gray-600 hover:text-gray-900 transition-colors">
              Roadmaps
            </a>

            {session?.user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 truncate max-w-[150px]" title={session.user.email ?? undefined}>
                  {session.user.email}
                </span>

                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all hover:shadow-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSignIn}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={handleGetStarted}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showLogin && (
        <Login
          onClose={() => setShowLogin(false)}
          onSwitchToSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
        />
      )}

      {showSignup && (
        <Signup
          onClose={() => setShowSignup(false)}
          onSwitchToLogin={() => {
            setShowSignup(false);
            setShowLogin(true);
          }}
        />
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>Transform Your Career Journey</span>
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Your Personalized Path to
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500"> Career Success</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              Get tailored career roadmaps based on your goals and practice with real-world exercises.
              Build the skills you need, track your progress, and land your dream job.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={async () => {
                  const result = await signIn("guest", { redirect: false });
                  if (!result?.error) {
                    setShowLogin(false);
                    setShowSignup(false);
                    router.push("/dashboard");
                  }
                }}
                className="group px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all hover:shadow-xl hover:scale-105 flex items-center gap-2"
              >
                Continue as Guest
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#roadmaps"
                className="px-8 py-4 bg-white text-gray-700 rounded-lg font-semibold border-2 border-gray-200 hover:border-gray-300 transition-all hover:shadow-lg"
              >
                Explore Roadmaps
              </a>
            </div>
          </div>

          {/* Hero Stats - reduced to two cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100">
              <div className="text-4xl font-bold text-blue-600 mb-2">50+</div>
              <div className="text-gray-600 font-medium">Career Roadmaps</div>
            </div>
            <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
              <div className="text-4xl font-bold text-green-600 mb-2">1000+</div>
              <div className="text-gray-600 font-medium">Practice Exercises</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - removed Community Support + AI-Powered Insights */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A comprehensive platform designed to guide you from where you are to where you want to be
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group p-8 bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Map className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Custom Roadmaps</h3>
              <p className="text-gray-600 leading-relaxed">
                Get personalized learning paths tailored to your career goals, experience level, and desired timeline.
              </p>
            </div>

            <div className="group p-8 bg-white rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Hands-On Practice</h3>
              <p className="text-gray-600 leading-relaxed">
                Apply what you learn with real-world projects, coding challenges, and interactive exercises.
              </p>
            </div>

            <div className="group p-8 bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Trophy className="w-7 h-7 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Track Progress</h3>
              <p className="text-gray-600 leading-relaxed">
                Monitor your advancement with detailed analytics, milestones, and achievement badges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How CareerForge Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A simple three-step process to transform your career aspirations into reality
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-1/4 left-1/3 w-1/3 h-1 bg-gradient-to-r from-blue-200 to-green-200"></div>
            <div className="hidden md:block absolute top-1/4 left-2/3 w-1/4 h-1 bg-gradient-to-r from-green-200 to-orange-200"></div>

            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Choose Your Goal</h3>
              <p className="text-gray-600 leading-relaxed">
                Select your desired career path from our extensive library or create a custom goal. Tell us your current level and target role.
              </p>
            </div>

            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Get Your Roadmap</h3>
              <p className="text-gray-600 leading-relaxed">
                Receive a personalized step-by-step roadmap with curated resources, milestones, and a realistic timeline for success.
              </p>
            </div>

            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-lg">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Practice & Progress</h3>
              <p className="text-gray-600 leading-relaxed">
                Complete hands-on exercises, build projects, and track your progress as you advance toward your career goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Roadmaps Section */}
      <section id="roadmaps" className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Popular Career Roadmaps
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join thousands learning these in-demand career paths
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Frontend Developer", skills: ["React", "TypeScript", "Tailwind"], color: "blue" },
              { title: "Backend Engineer", skills: ["Node.js", "PostgreSQL", "APIs"], color: "green" },
              { title: "Data Scientist", skills: ["Python", "ML", "Statistics"], color: "orange" },
              { title: "DevOps Engineer", skills: ["Docker", "AWS", "CI/CD"], color: "cyan" },
            ].map((roadmapCard, index) => (
              <div
                key={index}
                onClick={() => openRoadmap(roadmapCard.title, roadmapCard.skills)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openRoadmap(roadmapCard.title, roadmapCard.skills);
                }}
                className="group p-6 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all cursor-pointer focus:outline-none"
              >
                <div className={`w-12 h-12 bg-${roadmapCard.color}-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Map className={`w-6 h-6 text-${roadmapCard.color}-600`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{roadmapCard.title}</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {roadmapCard.skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-3xl p-12 md:p-16 text-center text-white shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Shape Your Future?</h2>
            <p className="text-xl mb-8 opacity-90">
              Join thousands of professionals who have transformed their careers with CareerForge
            </p>
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-50 transition-all hover:shadow-xl hover:scale-105 inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="mt-8 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span>Free forever plan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Target className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold">CareerForge</span>
            </div>
            <div className="text-gray-400 text-sm">© 2025 CareerForge. Building careers, one roadmap at a time.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
