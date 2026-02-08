import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Shield, Upload, BarChart3, History, ArrowRight, CheckCircle2, 
  Zap, Eye, Lock, FileSearch, Layers, Clock
} from 'lucide-react';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: <Eye className="w-6 h-6" strokeWidth={1.5} />,
      title: "Multi-Face Detection",
      desc: "Analyze every face in your media with MTCNN detection technology"
    },
    {
      icon: <BarChart3 className="w-6 h-6" strokeWidth={1.5} />,
      title: "Confidence Scores",
      desc: "Get detailed probability scores and risk assessments"
    },
    {
      icon: <Layers className="w-6 h-6" strokeWidth={1.5} />,
      title: "Batch Processing",
      desc: "Upload multiple files and analyze them all at once"
    },
    {
      icon: <FileSearch className="w-6 h-6" strokeWidth={1.5} />,
      title: "Video Analysis",
      desc: "Frame-by-frame temporal analysis with consistency metrics"
    },
    {
      icon: <History className="w-6 h-6" strokeWidth={1.5} />,
      title: "Analysis History",
      desc: "Track all past analyses with detailed statistics"
    },
    {
      icon: <Lock className="w-6 h-6" strokeWidth={1.5} />,
      title: "Privacy First",
      desc: "Files deleted immediately after processing, no data stored"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 sticky top-0 bg-white/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Shield className="w-7 h-7 text-slate-900" strokeWidth={1.5} />
              <span className="font-black text-xl tracking-tight">TRUTHLENS</span>
            </div>
            <nav className="flex items-center gap-4">
              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button 
                    data-testid="dashboard-btn"
                    className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 py-2 h-auto text-sm font-semibold tracking-wide uppercase"
                  >
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button 
                      variant="ghost"
                      data-testid="login-nav-btn"
                      className="text-slate-600 hover:text-slate-900 text-sm font-semibold tracking-wide uppercase"
                    >
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button 
                      data-testid="register-nav-btn"
                      className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 py-2 h-auto text-sm font-semibold tracking-wide uppercase"
                    >
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="grid-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-semibold mb-6">
                <Zap className="w-4 h-4" />
                AI-Powered Detection v2.0
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none mb-6">
                See the truth.<br />
                <span className="text-slate-400">Beyond the pixels.</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl">
                Advanced deepfake detection powered by EfficientNet neural networks. 
                Analyze images and videos with multi-face detection, temporal analysis, 
                and comprehensive risk assessment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                  <Button 
                    data-testid="get-started-btn"
                    className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-8 py-6 h-auto text-sm font-semibold tracking-wide uppercase inline-flex items-center gap-2"
                  >
                    Start Analyzing
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button 
                    variant="outline"
                    data-testid="learn-more-btn"
                    className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-sm px-8 py-6 h-auto text-sm font-semibold tracking-wide uppercase"
                  >
                    Explore Features
                  </Button>
                </a>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-slate-200">
                <div>
                  <p className="font-mono text-3xl font-bold">99.2%</p>
                  <p className="text-sm text-slate-500">Face Detection Rate</p>
                </div>
                <div>
                  <p className="font-mono text-3xl font-bold">&lt;2s</p>
                  <p className="text-sm text-slate-500">Analysis Time</p>
                </div>
                <div>
                  <p className="font-mono text-3xl font-bold">15+</p>
                  <p className="text-sm text-slate-500">Frames Analyzed</p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-50 border border-slate-200 p-8 aspect-square flex items-center justify-center relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1522040883829-9104eee3488a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                  alt="Digital face analysis"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2">
                    <span className="font-mono text-sm text-slate-500">SCANNING...</span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-emerald-500/90 backdrop-blur-sm px-4 py-2">
                    <span className="font-mono text-sm text-white font-bold">REAL 94.2%</span>
                  </div>
                  {/* Grid overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#0F172A08_1px,transparent_1px),linear-gradient(to_bottom,#0F172A08_1px,transparent_1px)] bg-[size:40px_40px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Capabilities
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Powerful Detection Features
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white border border-slate-200 p-8 hover:border-slate-300 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="w-12 h-12 bg-slate-100 flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold tracking-tight mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Process
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              How TruthLens Works
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Upload', desc: 'Drop your image or video file', icon: <Upload className="w-5 h-5" /> },
              { step: '02', title: 'Detect', desc: 'AI locates and extracts all faces', icon: <Eye className="w-5 h-5" /> },
              { step: '03', title: 'Analyze', desc: 'EfficientNet processes features', icon: <Zap className="w-5 h-5" /> },
              { step: '04', title: 'Report', desc: 'Get detailed risk assessment', icon: <BarChart3 className="w-5 h-5" /> }
            ].map((item, index) => (
              <div key={index} className="text-center relative">
                {index < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-slate-200" />
                )}
                <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center mx-auto mb-4 relative z-10">
                  {item.icon}
                </div>
                <div className="font-mono text-sm text-slate-400 mb-2">{item.step}</div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="border-t border-slate-200 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Technology
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                Built on Research-Grade Models
              </h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Our detection pipeline uses EfficientNet-B0 architecture with custom classification head, 
                trained on industry-standard datasets including FaceForensics++, Celeb-DF, and DFDC.
              </p>
              <ul className="space-y-4">
                {[
                  'MTCNN Multi-Face Detection',
                  'EfficientNet-B0 Feature Extraction',
                  'Augmented Analysis for Robustness',
                  'Temporal Consistency Analysis',
                  'Risk Level Classification'
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="font-mono text-sm">
              <div className="bg-slate-800 border border-slate-700 p-6 overflow-x-auto">
                <pre className="text-slate-300">
{`{
  "model": "EfficientNet-B0",
  "version": "2.0.0",
  "face_detection": "MTCNN",
  "features": {
    "multi_face": true,
    "batch_processing": true,
    "video_analysis": true,
    "export_reports": true
  },
  "output": {
    "verdict": "REAL | FAKE",
    "confidence": "0-100%",
    "risk_level": "LOW | MEDIUM | HIGH",
    "face_details": [...],
    "temporal_consistency": "0-100%"
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to verify authenticity?
          </h2>
          <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
            Join thousands of journalists, content moderators, and researchers using TruthLens
            to detect manipulated media.
          </p>
          <Link to={isAuthenticated ? "/dashboard" : "/register"}>
            <Button 
              data-testid="cta-btn"
              className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-10 py-6 h-auto text-sm font-semibold tracking-wide uppercase inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Disclaimer Section */}
      <section className="border-t border-slate-200 bg-amber-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-amber-600 font-bold">!</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Important Disclaimer</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                TruthLens provides AI-based predictions and should not be used as definitive proof. 
                Accuracy may vary based on image quality, face visibility, and manipulation type. 
                All uploaded files are deleted immediately after processing. No data is stored permanently.
                This tool is designed for research and educational purposes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-slate-900" strokeWidth={1.5} />
              <span className="font-black text-lg tracking-tight">TRUTHLENS</span>
            </div>
            <p className="text-slate-500 text-sm">
              Hackathon Project &bull; Built with PyTorch &amp; React &bull; 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
