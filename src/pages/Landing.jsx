import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Activity, Fingerprint } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen bg-[#050505] text-white overflow-hidden relative selection:bg-cyan-500/30 font-sans">
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      {/* CyberHUD Decoration Lines */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start opacity-30">
              <div className="w-32 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
              <div className="w-32 h-[1px] bg-gradient-to-l from-cyan-500 to-transparent"></div>
          </div>
          <div className="flex justify-between items-end opacity-30">
              <div className="w-32 h-[1px] bg-gradient-to-r from-cyan-500 to-transparent"></div>
              <div className="w-32 h-[1px] bg-gradient-to-l from-cyan-500 to-transparent"></div>
          </div>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
        
        {/* Main Content */}
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center"
        >
            {/* Tagline */}
            <div className="flex items-center justify-center gap-2 mb-6 text-cyan-400/80 tracking-[0.3em] text-xs font-bold uppercase">
                <Sparkles size={14} className="animate-pulse" />
                <span>Next Gen Visuals</span>
                <Sparkles size={14} className="animate-pulse" />
            </div>

            {/* Title */}
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-4 relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-cyan-100 to-cyan-900/50 filter drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                    AURALIS
                </span>
                {/* Glitch Effect Duplicate */}
                <span className="absolute inset-0 text-cyan-500/20 blur-[2px] animate-pulse" aria-hidden="true">
                    AURALIS
                </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-cyan-100/60 font-light tracking-wide max-w-2xl mx-auto mb-12">
                Gesture-controlled, audio-reactive particle experience.
                <br />
                <span className="text-sm opacity-50 mt-2 block">Immerse yourself in a universe of light and sound.</span>
            </p>

            {/* CTA Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/visualizer')}
                className="group relative px-10 py-4 bg-transparent overflow-hidden rounded-full"
            >
                <div className="absolute inset-0 w-full h-full bg-cyan-500/10 border border-cyan-500/50 rounded-full group-hover:bg-cyan-500/20 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.2)] group-hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]"></div>
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                
                <span className="relative flex items-center gap-3 text-cyan-300 font-bold tracking-widest uppercase text-sm">
                    Launch Auralis
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
            </motion.button>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="absolute bottom-12 flex gap-8 md:gap-16 text-xs text-cyan-200/40 font-mono tracking-widest uppercase"
        >
            <div className="flex items-center gap-2">
                <Fingerprint size={14} />
                <span>Hand Tracking</span>
            </div>
            <div className="flex items-center gap-2">
                <Activity size={14} />
                <span>Real-time Physics</span>
            </div>
        </motion.div>

      </div>
    </div>
  );
}
