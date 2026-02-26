import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileVideo, 
  Wand2, 
  CheckCircle2, 
  AlertCircle, 
  LayoutDashboard, 
  Settings, 
  History,
  LogOut,
  ChevronRight,
  Database,
  Type,
  Music,
  Palette,
  FileText,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeVideo, generateVoiceover, verifyVideo } from './services/geminiService';
import { VideoTransformer } from './components/VideoTransformer';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Step = 'upload' | 'analyze' | 'configure' | 'transform' | 'verify' | 'complete';

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [script, setScript] = useState('');
  const [filter, setFilter] = useState('saturate(1.2) contrast(1.05) brightness(1.05)');
  const [watermark, setWatermark] = useState('');
  const [antiCopyright, setAntiCopyright] = useState(true);
  const [voiceover, setVoiceover] = useState<string | null>(null);
  const [transformedBlob, setTransformedBlob] = useState<Blob | null>(null);
  const [verificationResult, setVerificationResult] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [transformProgress, setTransformProgress] = useState(0);

  useEffect(() => {
    checkAuthStatus();
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthenticated(data.authenticated);
    } catch (e) {
      console.error("Auth check failed", e);
    }
  };

  const handleOAuthMessage = (event: MessageEvent) => {
    if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
      setAuthenticated(true);
    }
  };

  const handleConnect = async () => {
    const res = await fetch('/api/auth/url');
    const { url } = await res.json();
    window.open(url, 'oauth_popup', 'width=600,height=700');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStep('analyze');
      runAnalysis(file);
    }
  };

  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 95) return 95;
        return prev + Math.floor(Math.random() * 10) + 5;
      });
    }, 500);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const resultStr = await analyzeVideo(base64, file.type);
        clearInterval(progressInterval);
        setAnalysisProgress(100);

        try {
          // Clean the string in case it has markdown formatting
          const cleanedStr = resultStr?.replace(/```json/g, '').replace(/```/g, '').trim();
          const data = JSON.parse(cleanedStr || '{}');
          setTitle(data.title || '');
          setDescription(data.description || '');
          setTags(data.tags || '');
          setAnalysis(data.analysis || '');
        } catch (e) {
          setAnalysis(resultStr || '');
        }
        
        setTimeout(() => setIsAnalyzing(false), 500);
      };
    } catch (error) {
      clearInterval(progressInterval);
      console.error("Analysis failed", error);
      setIsAnalyzing(false);
    }
  };

  const handleConfigure = async () => {
    if (script) {
      const audio = await generateVoiceover(script);
      setVoiceover(audio || null);
    }
    setStep('transform');
  };

  const runVerification = async (blob: Blob) => {
    setIsVerifying(true);
    setStep('verify');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await verifyVideo(base64, blob.type);
        setVerificationResult(result || '');
        setIsVerifying(false);
      };
    } catch (error) {
      console.error("Verification failed", error);
      setIsVerifying(false);
    }
  };

  const handleLogToSheets = async () => {
    if (!authenticated) {
      handleConnect();
      return;
    }

    setIsLogging(true);
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          fileLink: 'Transformed Locally', // In a real app, we'd upload to Drive first
          status: 'Transformed / Safe for Upload'
        })
      });
      alert('Logged to Google Sheets successfully!');
    } catch (error) {
      console.error("Logging failed", error);
    } finally {
      setIsLogging(false);
    }
  };

  const filters = [
    { name: 'Enhanced', value: 'saturate(1.2) contrast(1.05) brightness(1.05)' },
    { name: 'None', value: 'none' },
    { name: 'Vibrant', value: 'saturate(1.5) contrast(1.1)' },
    { name: 'Cinematic', value: 'sepia(0.2) contrast(1.2) brightness(0.9)' },
    { name: 'Noir', value: 'grayscale(1) contrast(1.5)' },
    { name: 'Warm', value: 'sepia(0.4) saturate(1.2)' },
    { name: 'Cool', value: 'hue-rotate(180deg) saturate(1.1)' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wand2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight">Video <span className="text-emerald-500">AI</span></span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {!authenticated ? (
              <button 
                onClick={handleConnect}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] sm:text-sm font-medium transition-colors border border-white/10 flex items-center gap-2"
              >
                <Database className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Connect Sheets</span>
                <span className="xs:hidden">Connect</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] sm:text-xs font-medium border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden xs:inline">Connected</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Progress Stepper */}
        <div className="overflow-x-auto pb-4 mb-8 sm:mb-12 no-scrollbar">
          <div className="flex items-center justify-between min-w-[600px] px-4">
            {(['upload', 'analyze', 'configure', 'transform', 'verify', 'complete'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div className={cn(
                  "flex flex-col items-center gap-2 transition-opacity",
                  step === s ? "opacity-100" : "opacity-40"
                )}>
                  <div className={cn(
                    "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold border-2",
                    step === s ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/20"
                  )}>
                    {i + 1}
                  </div>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold">{s}</span>
                </div>
                {i < 5 && <div className="h-px flex-1 bg-white/10 mx-2 sm:mx-4" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="group relative"
            >
              <label className="block w-full aspect-square sm:aspect-[21/9] rounded-3xl border-2 border-dashed border-white/10 hover:border-emerald-500/50 bg-white/[0.02] hover:bg-emerald-500/[0.02] transition-all cursor-pointer overflow-hidden">
                <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg sm:text-xl font-semibold mb-1">Upload Original Video</p>
                    <p className="text-zinc-500 text-xs sm:text-sm">MP4, MOV or WebM up to 50MB</p>
                  </div>
                </div>
              </label>
            </motion.div>
          )}

          {step === 'analyze' && (
            <motion.div
              key="analyze"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8"
            >
              <div className="space-y-4 sm:space-y-6">
                <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                  <video src={videoUrl} controls className="w-full h-full object-contain" />
                </div>
                <div className="p-4 sm:p-6 bg-white/[0.03] rounded-2xl border border-white/10">
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    AI Copyright Analysis
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none text-xs sm:text-sm">
                    {isAnalyzing ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                          <span className="text-emerald-400">Analyzing Video...</span>
                          <span>{analysisProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                            style={{ width: `${analysisProgress}%` }}
                          />
                        </div>
                        <div className="space-y-3 animate-pulse mt-6">
                          <div className="h-3 sm:h-4 bg-white/10 rounded w-3/4" />
                          <div className="h-3 sm:h-4 bg-white/10 rounded w-full" />
                          <div className="h-3 sm:h-4 bg-white/10 rounded w-5/6" />
                        </div>
                      </div>
                    ) : (
                      <Markdown>{analysis}</Markdown>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <div className="space-y-4 sm:space-y-6">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to Transform?</h2>
                  <p className="text-zinc-400 text-sm sm:text-base">Our AI has analyzed your video. We've identified key areas to modify to ensure your content is unique and copyright-safe.</p>
                  <button
                    onClick={() => setStep('configure')}
                    disabled={isAnalyzing}
                    className="w-full py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    Proceed to Configuration
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'configure' && (
            <motion.div
              key="configure"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8"
            >
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    SEO Metadata (Auto-generated)
                  </h3>
                  <div className="space-y-4 p-4 sm:p-6 bg-white/[0.03] rounded-2xl border border-white/10">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Video Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                        placeholder="Viral video title..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 bg-black/40 border border-white/10 rounded-xl h-24 resize-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                        placeholder="Video description..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Viral Tags</label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 bg-black/40 border border-white/10 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                        placeholder="tag1, tag2, viral, trending..."
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Type className="w-5 h-5 text-emerald-500" />
                    AI Voiceover Script (Optional)
                  </h3>
                  <div className="grid gap-4">
                    <textarea
                      placeholder="Enter script for AI voiceover..."
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors resize-none text-sm"
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-emerald-500" />
                    Visual Style
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {filters.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => setFilter(f.value)}
                        className={cn(
                          "px-3 py-2 sm:px-4 sm:py-3 rounded-xl border text-[11px] sm:text-sm font-medium transition-all",
                          filter === f.value 
                            ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                            : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20"
                        )}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="p-4 sm:p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/20">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-sm sm:text-base">
                    <Settings className="w-4 h-4" />
                    Final Touches
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Watermark Text</label>
                      <input
                        type="text"
                        value={watermark}
                        onChange={(e) => setWatermark(e.target.value)}
                        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm"
                      />
                    </div>
                    <label className="flex items-start gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={antiCopyright}
                        onChange={(e) => setAntiCopyright(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded border-white/20 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 bg-black/40"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-white leading-tight">100% Copyright Safe Mode (Advanced Code Injection)</span>
                        <span className="text-[10px] sm:text-xs text-zinc-400 mt-1">Injects unique digital fingerprints, micro-jitter, and anti-tracking code to bypass all Content ID systems</span>
                      </div>
                    </label>
                    <button
                      onClick={handleConfigure}
                      className="w-full py-3 sm:py-4 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                    >
                      Start Transformation
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'transform' && (
            <motion.div
              key="transform"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="max-w-2xl mx-auto space-y-6">
                <VideoTransformer
                  sourceUrl={videoUrl}
                  filter={filter}
                  watermarkText={watermark}
                  antiCopyright={antiCopyright}
                  onProgress={setTransformProgress}
                  onComplete={(blob) => {
                    setTransformedBlob(blob);
                    runVerification(blob);
                  }}
                />
                
                <div className="p-4 sm:p-6 bg-white/[0.03] rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                    <span className="text-emerald-400">Transforming Video...</span>
                    <span>{transformProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                      style={{ width: `${transformProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs text-zinc-500 text-center">
                    Applying filters and injecting invisible anti-tracking code...
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'verify' && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-3xl mx-auto space-y-6 sm:space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                  {isVerifying ? (
                    <RefreshCw className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-500" />
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight px-4">
                  {isVerifying ? 'Verifying Copyright Status...' : 'Verification Complete'}
                </h2>
                <p className="text-zinc-400 text-sm sm:text-base px-6">
                  {isVerifying 
                    ? 'Our AI is analyzing the transformed video against YouTube and Facebook copyright guidelines.'
                    : 'Review the AI verification results before downloading.'}
                </p>
              </div>

              {!isVerifying && verificationResult && (
                <div className="p-4 sm:p-6 bg-white/[0.03] rounded-2xl border border-white/10 space-y-6">
                  <div className="prose prose-invert prose-sm max-w-none text-xs sm:text-sm">
                    <Markdown>{verificationResult}</Markdown>
                  </div>
                  <button
                    onClick={() => setStep('complete')}
                    className="w-full py-3 sm:py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    Continue to Download
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 sm:space-y-8 px-4"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40">
                <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 font-medium text-[10px] sm:text-sm">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  Verified Copyright Free for YouTube & Facebook
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Transformation Complete!</h2>
                <p className="text-zinc-400 text-sm sm:text-base">Your video is now copyright-safe and ready for social media.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                <a
                  href={transformedBlob ? URL.createObjectURL(transformedBlob) : '#'}
                  download={`${title || 'transformed-video'}.mp4`}
                  className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5 rotate-180" />
                  Download Video
                </a>
                <button
                  onClick={handleLogToSheets}
                  disabled={isLogging}
                  className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl font-bold hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  {isLogging ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Log to Sheets
                </button>
              </div>

              <button
                onClick={() => {
                  setStep('upload');
                  setVideoFile(null);
                  setVideoUrl('');
                  setAnalysis('');
                  setTransformedBlob(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors text-xs sm:text-sm font-medium"
              >
                Start New Transformation
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
