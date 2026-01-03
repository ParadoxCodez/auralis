import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Camera, Settings2, Sparkles, Activity, BoxSelect, Maximize2, Scan, Globe, Cpu, X, Upload, Play, Pause, Music, FileText, Mic, Loader2, ChevronRight } from 'lucide-react';
import { GestureController } from '../gestures';
import { ShapeGenerators } from '../utils';
import { vertexShader, fragmentShader } from '../shaders';
import { generateLyrics } from '../ai/lyricsGenerator';
import gsap from 'gsap';

// --- CyberHUD Component ---
const CyberHUD = () => (
  <div className="absolute inset-0 pointer-events-none z-10 p-6 flex flex-col justify-between">
    {/* Top Bar - Minimal */}
    <div className="flex justify-between items-start">
        <div className="flex gap-2 opacity-50">
            <div className="w-1 h-8 bg-cyan-500"></div>
        </div>
        <div className="flex gap-2 items-start opacity-50">
             <div className="w-8 h-1 bg-cyan-500"></div>
        </div>
    </div>

    {/* Bottom Corners */}
    <div className="flex justify-between items-end">
        <div className="flex items-end gap-2 opacity-50">
             <div className="h-px w-12 bg-cyan-500"></div>
        </div>
        <div className="flex items-end gap-2 opacity-50">
             <div className="h-px w-12 bg-cyan-500"></div>
        </div>
    </div>
  </div>
);

// Particle Component
const ParticleCloud = ({ config, gestureState, analyser, dataArray }) => {
  const pointsRef = useRef();
  const materialRef = useRef();
  
  // Audio Analysis State
  const smoothedBass = useRef(0);
  const smoothedMid = useRef(0);
  const smoothedTreble = useRef(0);
  const smoothedRMS = useRef(0);
  
  const count = config.count; 
  
  const { currentPositions, targetPositions, sizes, seeds } = useMemo(() => {
    const cp = new Float32Array(count * 3);
    const tp = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const sd = new Float32Array(count);

    const initial = ShapeGenerators[config.shape || 'sphere'](count);
    for (let i = 0; i < count; i++) {
        cp[i * 3] = initial[i * 3] || 0;
        cp[i * 3 + 1] = initial[i * 3 + 1] || 0;
        cp[i * 3 + 2] = initial[i * 3 + 2] || 0;
        
        tp[i * 3] = cp[i * 3];
        tp[i * 3 + 1] = cp[i * 3 + 1];
        tp[i * 3 + 2] = cp[i * 3 + 2];

        sz[i] = 0.65 + Math.pow(Math.random(), 0.35) * 0.45;
        sd[i] = Math.random();
    }
    return { currentPositions: cp, targetPositions: tp, sizes: sz, seeds: sd };
  }, [count]);

  // Handle Shape Morphing
  useEffect(() => {
    if (!materialRef.current || !pointsRef.current) return;

    const currentFactor = materialRef.current.uniforms.uMorphFactor.value;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.currentPosition;
    const targetAttr = geometry.attributes.targetPosition;

    // Snapshot current state
    for (let i = 0; i < count * 3; i++) {
        const a = posAttr.array[i];
        const b = targetAttr.array[i];
        posAttr.array[i] = a + (b - a) * currentFactor;
    }
    posAttr.needsUpdate = true;

    // Generate New Target
    const newPoints = ShapeGenerators[config.shape](count);
    for (let i = 0; i < count * 3; i++) {
        targetAttr.array[i] = newPoints[i] || 0;
    }
    targetAttr.needsUpdate = true;

    // Animate
    materialRef.current.uniforms.uMorphFactor.value = 0.0;
    gsap.to(materialRef.current.uniforms.uMorphFactor, {
        value: 1.0,
        duration: 1.5,
        ease: "power2.inOut"
    });

  }, [config.shape, count]);

  // Handle Color
  useEffect(() => {
    if(materialRef.current) {
        gsap.to(materialRef.current.uniforms.uColor.value, {
            r: new THREE.Color(config.color).r,
            g: new THREE.Color(config.color).g,
            b: new THREE.Color(config.color).b,
            duration: 0.5
        });
    }
  }, [config.color]);

  // Handle Noise/Size
  useEffect(() => {
      if(materialRef.current) {
          materialRef.current.uniforms.uNoiseStrength.value = config.noise;
          materialRef.current.uniforms.uSize.value = config.size;
      }
  }, [config.noise, config.size]);


  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    materialRef.current.uniforms.uTime.value = time;
    
    // Audio Analysis
    if (analyser && analyser.current && dataArray && dataArray.current) {
        analyser.current.getByteFrequencyData(dataArray.current);
        
        // Frequency Bands
        let bass = 0, mid = 0, treble = 0, total = 0;
        const bins = dataArray.current.length;
        
        // Bass: 0-4 (~0-800Hz)
        for(let i = 0; i < 5; i++) bass += dataArray.current[i];
        bass = bass / 5 / 255.0;
        bass = Math.pow(bass, 1.5); // Soft compression

        // Mid: 5-20 (~800-3400Hz)
        for(let i = 5; i < 21; i++) mid += dataArray.current[i];
        mid = mid / 16 / 255.0;
        mid = Math.pow(mid, 1.5);

        // Treble: 21-127 (~3400Hz+)
        for(let i = 21; i < bins; i++) treble += dataArray.current[i];
        treble = treble / (bins - 21) / 255.0;
        treble = Math.pow(treble, 1.5);

        // RMS (Total Energy)
        for(let i = 0; i < bins; i++) total += dataArray.current[i];
        const rms = total / bins / 255.0;
        
        // Smooth Values (Linear Interpolation)
        const lerp = (start, end, factor) => start + (end - start) * factor;
        
        smoothedBass.current = lerp(smoothedBass.current, bass, 0.12);
        smoothedMid.current = lerp(smoothedMid.current, mid, 0.1);
        smoothedTreble.current = lerp(smoothedTreble.current, treble, 0.1);
        smoothedRMS.current = lerp(smoothedRMS.current, rms, 0.08);

        // Map to Uniforms
        // Bass -> Cloud Pulse (BeatSignal) & Particle Size
        // Clamp influence to prevent over-expansion
        const bassInfluence = Math.min(smoothedBass.current, 0.8);
        
        // BeatSignal (Position Expansion): scale = 1 + uBeatSignal * 0.3
        materialRef.current.uniforms.uBeatSignal.value = bassInfluence * 0.8; 

        // Size: scale = base * (1 + influence * boost)
        materialRef.current.uniforms.uSize.value = config.size * (1.0 + bassInfluence * 0.5);
        
        // Treble + RMS -> Chaos/Sparkle
        const trebleInfluence = Math.min(smoothedTreble.current + smoothedRMS.current * 0.5, 1.0);
        materialRef.current.uniforms.uNoiseStrength.value = config.noise + trebleInfluence * 0.5;
    } else {
        // Reset/Drift back to config values if no audio
        materialRef.current.uniforms.uBeatSignal.value *= 0.95;
        materialRef.current.uniforms.uSize.value += (config.size - materialRef.current.uniforms.uSize.value) * 0.1;
        materialRef.current.uniforms.uNoiseStrength.value += (config.noise - materialRef.current.uniforms.uNoiseStrength.value) * 0.1;
    }

    // Mouse Interaction
    const p = state.pointer;
    const vec = new THREE.Vector3(p.x, p.y, 0.5);
    vec.unproject(state.camera);
    const dir = vec.sub(state.camera.position).normalize();
    const distance = -state.camera.position.z / dir.z;
    const pos = state.camera.position.clone().add(dir.multiplyScalar(distance));
    materialRef.current.uniforms.uMouse.value.copy(pos);

    // Gestures
    const g = gestureState.current;
    
    const damp = (current, target, speed) => current + (target - current) * (1 - Math.exp(-speed * 0.016));

    let targetSpread = 0.0;
    let targetScale = 1.0;
    let targetRotX = 0; 
    let targetRotY = time * 0.08; 
    let targetRotZ = 0;

    if (g.hasHands) {
        targetSpread = (g.spread - 0.22) * 1.8;
        targetScale = g.scale;
        targetRotX = g.rotationX;
        targetRotY = g.rotationY;
        targetRotZ = g.rotationZ;
    }
    
    // Mid Freqs -> Subtle Distortion/Spread (Adds to gesture or stands alone)
    targetSpread += smoothedMid.current * 0.8;

    materialRef.current.uniforms.uGestureSpread.value = damp(materialRef.current.uniforms.uGestureSpread.value, targetSpread, 14.0);
    materialRef.current.uniforms.uGestureScale.value = damp(materialRef.current.uniforms.uGestureScale.value, targetScale, 10.0);

    pointsRef.current.rotation.x = damp(pointsRef.current.rotation.x, targetRotX, 8.0);
    pointsRef.current.rotation.y = damp(pointsRef.current.rotation.y, targetRotY, 8.0);
    pointsRef.current.rotation.z = damp(pointsRef.current.rotation.z, targetRotZ, 7.0);
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSize: { value: config.size },
    uColor: { value: new THREE.Color(config.color) },
    uGestureScale: { value: 1.0 },
    uGestureSpread: { value: 0.0 },
    uNoiseStrength: { value: config.noise },
    uMouse: { value: new THREE.Vector3(999, 999, 999) },
    uBeatSignal: { value: 0.0 },
    uMorphFactor: { value: 1.0 }
  }), []);

  return (
    <points ref={pointsRef} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-currentPosition" count={count} array={currentPositions} itemSize={3} />
        <bufferAttribute attach="attributes-targetPosition" count={count} array={targetPositions} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" count={count} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-aSeed" count={count} array={seeds} itemSize={1} />
        <bufferAttribute attach="attributes-position" count={count} array={currentPositions} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial 
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default function Visualizer() {
  const [config, setConfig] = useState({
    shape: 'sphere',
    color: '#00f3ff',
    size: 2.0,
    noise: 0.45,
    count: 8000 
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [handCoords, setHandCoords] = useState([]);
  const [audioSrc, setAudioSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const gestureController = useRef();
  const gestureState = useRef({ hasHands: false, spread: 0, scale: 1, rotationX: 0, rotationY: 0, rotationZ: 0, hands: [] });
  const videoRef = useRef();
  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);

  // Lyrics State
  const [lyrics, setLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [songInput, setSongInput] = useState({ title: '', artist: '' });
  const lyricsScrollRef = useRef(null);

  const handleGenerateLyrics = async () => {
    if (!songInput.title.trim()) return;
    setLyricsLoading(true);
    setLyrics('');
    try {
        const text = await generateLyrics(songInput.title, songInput.artist);
        setLyrics(text);
    } catch (err) {
        console.error(err);
        setLyrics("Error generating lyrics. Please check your API key and try again.");
    } finally {
        setLyricsLoading(false);
    }
  };

  // Auto-scroll lyrics
  useEffect(() => {
    let scrollInterval;
    if (showLyricsPanel && lyrics && !lyricsLoading) {
        scrollInterval = setInterval(() => {
            if (lyricsScrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = lyricsScrollRef.current;
                if (scrollTop + clientHeight < scrollHeight) {
                    lyricsScrollRef.current.scrollTop += 1;
                }
            }
        }, 100); 
    }
    return () => clearInterval(scrollInterval);
  }, [showLyricsPanel, lyrics, lyricsLoading]);

  useEffect(() => {
    // Clean up audio on unmount
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
    };
  }, []);

  const initAudio = () => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        
        if (audioRef.current && !sourceRef.current) {
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }
    } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        initAudio();
        const url = URL.createObjectURL(file);
        setAudioSrc(url);
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
    }
  };

  const toggleAudio = () => {
    initAudio();
    if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
    } else {
        audioRef.current.pause();
        setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (videoRef.current && !gestureController.current) {
        gestureController.current = new GestureController(videoRef.current);
    }
  }, []);

  useEffect(() => {
    let raf;
    const update = () => {
        if(cameraActive && gestureController.current) {
            gestureController.current.update();
            gestureState.current = gestureController.current.getState();
            setHandCoords(gestureState.current.hands || []);
        } else {
             gestureState.current.hasHands = false;
             setHandCoords([]);
        }
        raf = requestAnimationFrame(update);
    }
    update();
    return () => cancelAnimationFrame(raf);
  }, [cameraActive]);

  const toggleCamera = () => {
    if (!cameraActive) {
        gestureController.current.startCamera();
        setCameraActive(true);
    } else {
        gestureController.current.stopCamera();
        setCameraActive(false);
    }
  };

  return (
    <div className="w-full h-screen relative bg-[#050505] text-white overflow-hidden selection:bg-cyan-500/30 font-sans">
      
      <CyberHUD />

      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 9], fov: 55 }}> 
          <color attach="background" args={['#050505']} />
          <ParticleCloud config={config} gestureState={gestureState} analyser={analyserRef} dataArray={dataArrayRef} />
          <EffectComposer>
             <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* TOP LEFT: Refined Logo */}
      <div className="absolute top-10 left-10 z-30 pointer-events-none select-none">
        <div className="flex flex-col gap-1">
            <h1 className="text-6xl font-black tracking-tighter drop-shadow-[0_0_25px_rgba(0,243,255,0.6)]">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-gray-500">PARTICLE</span>
                <span className="text-cyan-400 inline-block ml-1" style={{ textShadow: "0 0 15px #00f3ff" }}>X</span>
            </h1>
            <div className="flex items-center gap-3 pl-1.5">
                <div className="w-12 h-1 bg-cyan-500 shadow-[0_0_10px_#00f3ff]"></div>
                <p className="text-xs text-cyan-400 font-mono tracking-[0.4em] uppercase font-bold">
                    SYS.V2.1 // ONLINE
                </p>
            </div>
        </div>
      </div>

      {/* LEFT CENTER: Hand Tracking Coordinates */}
      <div className={`absolute top-1/2 left-8 transform -translate-y-1/2 z-30 transition-opacity duration-300 ${handCoords.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5 w-48">
             <div className="flex items-center gap-2 mb-3 text-xs font-bold text-cyan-400">
                <Scan size={14} />
                <span className="tracking-widest">TRACKING DATA</span>
             </div>
             <div className="space-y-3">
                {handCoords.map((hand, i) => (
                    <div key={i} className="font-mono text-[10px]">
                        <div className="flex items-center gap-2 mb-1 text-cyan-200/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#00f3ff]"></div>
                            <span>HAND_0{i + 1} // DETECTED</span>
                        </div>
                        <div className="grid grid-cols-[20px_1fr] gap-1 pl-3.5 text-cyan-100/80">
                            <span className="text-cyan-500/50">X</span>
                            <span>{hand.x.toFixed(4)}</span>
                            <span className="text-cyan-500/50">Y</span>
                            <span>{hand.y.toFixed(4)}</span>
                            <span className="text-cyan-500/50">Z</span>
                            <span>{hand.z.toFixed(4)}</span>
                        </div>
                    </div>
                ))}
                {handCoords.length === 0 && (
                     <div className="text-[10px] text-white/30 italic text-center py-2">
                        NO SIGNAL
                     </div>
                )}
             </div>
          </div>
      </div>

      {/* TOP RIGHT: Sliders & Color */}
      <div className="absolute top-8 right-8 z-30 w-64">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl ring-1 ring-white/5">
             {/* Header */}
             <div className="flex items-center gap-2 mb-4 text-xs font-bold text-cyan-400">
                <Settings2 size={14} />
                <span className="tracking-widest">CONFIGURATION</span>
             </div>

             {/* Audio Upload Section */}
             <div className="mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-2 text-[10px] text-cyan-200/70 font-mono">
                    <span>AUDIO INPUT</span>
                    {audioSrc && <Music size={10} className="text-cyan-400 animate-pulse" />}
                </div>
                
                {!audioSrc ? (
                    <label className="flex items-center justify-center gap-2 w-full py-2 border border-dashed border-cyan-500/30 rounded-lg cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/60 transition-all group">
                        <Upload size={12} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] text-cyan-300 font-bold tracking-wider">UPLOAD TRACK</span>
                        <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                ) : (
                    <div className="flex items-center gap-2">
                         <button 
                            onClick={toggleAudio}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-[10px] tracking-wider transition-all ${
                                isPlaying 
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                            }`}
                         >
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            {isPlaying ? 'PAUSE' : 'PLAY'}
                         </button>
                         <label className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 cursor-pointer transition-colors" title="Change Track">
                            <Upload size={12} />
                            <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                         </label>
                    </div>
                )}
             </div>

             {/* Size Slider */}
             <div className="mb-4">
                 <div className="flex justify-between text-[10px] text-cyan-200/70 mb-1 font-mono">
                    <span>SIZE</span>
                    <span>{config.size.toFixed(1)}</span>
                 </div>
                 <input 
                    type="range" min="0.5" max="8.0" step="0.1"
                    value={config.size}
                    onChange={(e) => setConfig(prev => ({...prev, size: Number(e.target.value)}))}
                    className="range-slider"
                 />
             </div>

             {/* Noise Slider */}
             <div className="mb-4">
                 <div className="flex justify-between text-[10px] text-cyan-200/70 mb-1 font-mono">
                    <span>CHAOS</span>
                    <span>{config.noise.toFixed(2)}</span>
                 </div>
                 <input 
                    type="range" min="0" max="2" step="0.05"
                    value={config.noise}
                    onChange={(e) => setConfig(prev => ({...prev, noise: Number(e.target.value)}))}
                    className="range-slider"
                 />
             </div>

             {/* Colors - Expanded Palette */}
             <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2 justify-between">
                {[
                  '#00f3ff', // Cyan
                  '#ffaa00', // Gold
                  '#ff0055', // Neon Pink
                  '#39ff14', // Neon Green
                  '#0066ff', // Deep Blue
                  '#8a2be2', // Purple
                  '#ff4500', // Orange Red
                  '#ffffff', // White
                  '#ffff00', // Yellow (New)
                  '#00ff99', // Spring Green (New)
                  '#ff00ff'  // Magenta (New)
                ].map(c => (
                    <button 
                        key={c}
                        onClick={() => setConfig(prev => ({...prev, color: c}))}
                        className={`w-4 h-4 rounded-full transition-all duration-300 ${config.color === c ? 'scale-150 ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-60 hover:opacity-100 hover:scale-125'}`}
                        style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}60` }}
                    />
                ))}
             </div>
        </div>
      </div>

      {/* BOTTOM LEFT: Shape Selector */}
      <div className="absolute bottom-8 left-8 z-30">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl ring-1 ring-white/5">
             <div className="flex items-center gap-2 mb-3 text-xs font-bold text-cyan-400">
                <BoxSelect size={14} />
                <span className="tracking-widest">GEOMETRY</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                {['sphere', 'saturn', 'heart', 'flower', 'fireworks'].map(s => (
                    <button 
                        key={s} 
                        onClick={() => setConfig(prev => ({...prev, shape: s}))}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-left transition-all duration-200 border ${
                            config.shape === s 
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' 
                            : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {s}
                    </button>
                ))}
             </div>
          </div>
      </div>

      {/* BOTTOM RIGHT: Camera Toggle & Preview */}
      <div className="absolute bottom-8 right-8 z-30 flex flex-col items-end gap-4">
          
          <div className={`transition-all duration-500 origin-bottom-right ${cameraActive ? 'scale-100 opacity-100' : 'scale-50 opacity-0 pointer-events-none'}`}>
             <div className="relative rounded-xl overflow-hidden border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                <video 
                    ref={videoRef} 
                    className="w-48 h-32 object-cover scale-x-[-1]" 
                    playsInline 
                    muted 
                    autoPlay
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] font-bold text-cyan-400">
                    <Activity size={10} className="animate-pulse" />
                    <span>TRACKING</span>
                </div>
             </div>
          </div>

          <button 
                onClick={toggleCamera}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-xs tracking-wider transition-all duration-300 shadow-lg ${
                    cameraActive 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50 shadow-red-500/20' 
                    : 'bg-cyan-500 text-black hover:bg-cyan-400 border border-cyan-400 shadow-cyan-500/40 hover:scale-105'
                }`}
            >
                <Camera size={16} />
                {cameraActive ? 'DISCONNECT' : 'ENABLE HAND CONTROL'}
          </button>
      </div>

      {/* LYRICS PANEL & TOGGLE */}
      <button
        onClick={() => setShowLyricsPanel(!showLyricsPanel)}
        className={`absolute top-[40%] right-0 z-40 bg-black/60 backdrop-blur-xl border-l border-y border-white/10 p-3 rounded-l-xl transition-all duration-300 hover:bg-white/10 group ${showLyricsPanel ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
        style={{ transitionDelay: showLyricsPanel ? '0ms' : '300ms' }}
      >
        <FileText size={20} className="text-cyan-400 group-hover:scale-110 transition-transform" />
      </button>

      <div 
        className={`absolute top-0 right-0 h-full w-[400px] bg-black/95 backdrop-blur-2xl border-l border-white/10 z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.8)] ${showLyricsPanel ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Panel Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <Mic size={18} className="text-cyan-400" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white tracking-wider">AI LYRICS</h3>
                    <p className="text-[10px] text-white/40 font-mono">POWERED BY GEMINI</p>
                </div>
             </div>
             <button 
                onClick={() => setShowLyricsPanel(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
             >
                <ChevronRight size={20} />
             </button>
        </div>

        {/* Inputs */}
        <div className="p-6 border-b border-white/10 space-y-4">
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-cyan-500/70 tracking-widest ml-1">SONG TITLE</label>
                <input 
                    type="text" 
                    value={songInput.title}
                    onChange={(e) => setSongInput(prev => ({...prev, title: e.target.value}))}
                    placeholder="Enter song name..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all font-mono"
                />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 tracking-widest ml-1">ARTIST (OPTIONAL)</label>
                <input 
                    type="text" 
                    value={songInput.artist}
                    onChange={(e) => setSongInput(prev => ({...prev, artist: e.target.value}))}
                    placeholder="Enter artist name..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all font-mono"
                />
            </div>
            <button 
                onClick={handleGenerateLyrics}
                disabled={lyricsLoading || !songInput.title}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-lg text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {lyricsLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {lyricsLoading ? 'GENERATING...' : 'GENERATE LYRICS'}
            </button>
        </div>

        {/* Lyrics Display */}
        <div className="flex-1 overflow-hidden relative group">
            <div 
                ref={lyricsScrollRef}
                className="absolute inset-0 overflow-y-auto p-8 space-y-6 scroll-smooth scrollbar-hide"
            >
                {lyrics ? (
                    <div className="text-center space-y-8 pb-20">
                         {lyrics.split('\n').map((line, i) => (
                            <p key={i} className={`text-sm font-medium transition-all duration-500 ${line.trim() === '' ? 'h-4' : 'text-white/80 hover:text-cyan-300 hover:scale-105 cursor-default'}`}>
                                {line}
                            </p>
                         ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                        <FileText size={40} strokeWidth={1} />
                        <p className="text-xs font-mono text-center max-w-[200px]">
                            ENTER A SONG TITLE ABOVE TO GENERATE LYRICS
                        </p>
                    </div>
                )}
            </div>
            {/* Gradient Masks */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/90 to-transparent pointer-events-none z-10"></div>
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-10"></div>
        </div>
      </div>

    </div>
  );
}
