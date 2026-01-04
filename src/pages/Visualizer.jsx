import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  Camera,
  Settings2,
  Sparkles,
  Activity,
  BoxSelect,
  Maximize2,
  Scan,
  Globe,
  Cpu,
  X,
  Upload,
  Play,
  Pause,
  Music,
  FileText,
  Mic,
  Loader2,
  ChevronRight,
  Heart,
  Flower2,
} from "lucide-react";
import { GestureController } from "../gestures";
import { ShapeGenerators } from "../utils";
import { vertexShader, fragmentShader } from "../shaders";
import { fetchLyrics } from "../ai/lyricsService";
import gsap from "gsap";

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
  const MAX_PARTICLE_SIZE = 3.5;

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

    const initial = ShapeGenerators[config.shape || "sphere"](count);
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
      ease: "power2.inOut",
    });
  }, [config.shape, count]);

  // Handle Color
  useEffect(() => {
    if (materialRef.current) {
      gsap.to(materialRef.current.uniforms.uColor.value, {
        r: new THREE.Color(config.color).r,
        g: new THREE.Color(config.color).g,
        b: new THREE.Color(config.color).b,
        duration: 0.5,
      });
    }
  }, [config.color]);

  // Handle Noise/Size
  useEffect(() => {
      if(materialRef.current) {
          materialRef.current.uniforms.uNoiseStrength.value = config.noise;
          materialRef.current.uniforms.uSize.value = Math.min(config.size, MAX_PARTICLE_SIZE);
      }
  }, [config.noise, config.size]);

  useFrame((state) => {
    if (!materialRef.current || !pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    materialRef.current.uniforms.uTime.value = time;
    const BASE_ROTATION_SPEED = 0.08;
    const audioActive =
      analyser &&
      analyser.current &&
      dataArray &&
      dataArray.current &&
      dataArray.current.length > 0;

    if (analyser && analyser.current && dataArray && dataArray.current) {
      if (audioActive) {
        analyser.current.getByteFrequencyData(dataArray.current);
      }
      let bass = 0,
        mid = 0,
        treble = 0,
        total = 0;
      const bins = dataArray.current.length;

      // Bass: 0-4 (~0-800Hz)
      for (let i = 0; i < 5; i++) bass += dataArray.current[i];
      bass = bass / 5 / 255.0;
      bass = Math.pow(bass, 1.5); // Soft compression

      // Mid: 5-20 (~800-3400Hz)
      for (let i = 5; i < 21; i++) mid += dataArray.current[i];
      mid = mid / 16 / 255.0;
      mid = Math.pow(mid, 1.5);

      // Treble: 21-127 (~3400Hz+)
      for (let i = 21; i < bins; i++) treble += dataArray.current[i];
      treble = treble / (bins - 21) / 255.0;
      treble = Math.pow(treble, 1.5);

      for (let i = 0; i < bins; i++) total += dataArray.current[i];
      let rms = total / bins / 255.0;
      if (!Number.isFinite(rms)) rms = 0;
      bass = Math.max(0, Math.min(bass, 1));
      mid = Math.max(0, Math.min(mid, 1));
      treble = Math.max(0, Math.min(treble, 1));

      // Smooth Values (Linear Interpolation)
      const lerp = (start, end, factor) => start + (end - start) * factor;

      smoothedBass.current = lerp(smoothedBass.current, bass, 0.12);
      smoothedMid.current = lerp(smoothedMid.current, mid, 0.1);
      smoothedTreble.current = lerp(smoothedTreble.current, treble, 0.1);
      smoothedRMS.current = lerp(smoothedRMS.current, rms, 0.08);

      const bassInfluence = Math.min(smoothedBass.current, 0.8);
      const hasEnergy = rms > 0.005 && Number.isFinite(rms);

      if (hasEnergy) {
        if (!Number.isFinite(materialRef.current.uniforms.uBeatSignal.value)) {
          materialRef.current.uniforms.uBeatSignal.value = 0;
        }
        materialRef.current.uniforms.uBeatSignal.value = Math.min(
          materialRef.current.uniforms.uBeatSignal.value + bassInfluence * 0.6,
          1.0
        );

        {
          const targetSize = Math.min(
            config.size * (1.0 + bassInfluence * 0.5),
            MAX_PARTICLE_SIZE
          );
          if (!Number.isFinite(materialRef.current.uniforms.uSize.value)) {
            materialRef.current.uniforms.uSize.value = config.size;
          }
          materialRef.current.uniforms.uSize.value = Math.max(
            0.3,
            materialRef.current.uniforms.uSize.value +
              (targetSize - materialRef.current.uniforms.uSize.value) * 0.2
          );
        }

      const trebleInfluence = Math.min(
        smoothedTreble.current + smoothedRMS.current * 0.5,
        1.0
      );
      {
        const targetNoise = config.noise + trebleInfluence * 0.5;
        if (
          !Number.isFinite(materialRef.current.uniforms.uNoiseStrength.value)
        ) {
          materialRef.current.uniforms.uNoiseStrength.value = config.noise;
        }
        materialRef.current.uniforms.uNoiseStrength.value =
          materialRef.current.uniforms.uNoiseStrength.value +
          (targetNoise - materialRef.current.uniforms.uNoiseStrength.value) *
            0.15;
      }

      if (micEnabled && micAnalyserRef.current && micDataArrayRef.current) {
        micAnalyserRef.current.getByteTimeDomainData(micDataArrayRef.current);
        let accum = 0;
        const arr = micDataArrayRef.current;
        for (let i = 0; i < arr.length; i++) {
          accum += Math.abs(arr[i] - 128);
        }
        const micLevel = Math.min(accum / (arr.length * 128), 1.0);
        const lerp = (start, end, factor) => start + (end - start) * factor;
        micLevelRef.current = lerp(micLevelRef.current, micLevel, 0.12);
        const micInfluence = Math.min(
          micLevelRef.current * micSensitivity,
          1.0
        );
        materialRef.current.uniforms.uBeatSignal.value = Math.min(
          materialRef.current.uniforms.uBeatSignal.value + micInfluence * 0.4,
          1.0
        );
        materialRef.current.uniforms.uNoiseStrength.value +=
          micInfluence * 0.35;
      }
      } else {
        materialRef.current.uniforms.uBeatSignal.value *= 0.95;
        materialRef.current.uniforms.uSize.value = Math.min(
          materialRef.current.uniforms.uSize.value +
            (config.size - materialRef.current.uniforms.uSize.value) * 0.1,
          MAX_PARTICLE_SIZE
        );
        materialRef.current.uniforms.uNoiseStrength.value +=
          (config.noise - materialRef.current.uniforms.uNoiseStrength.value) *
          0.1;
      }
    } else {
      materialRef.current.uniforms.uBeatSignal.value *= 0.95;
      materialRef.current.uniforms.uSize.value = Math.min(
        materialRef.current.uniforms.uSize.value +
          (config.size - materialRef.current.uniforms.uSize.value) * 0.1,
        MAX_PARTICLE_SIZE
      );
      materialRef.current.uniforms.uNoiseStrength.value +=
        (config.noise - materialRef.current.uniforms.uNoiseStrength.value) *
        0.1;
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

    const damp = (current, target, speed) =>
      current + (target - current) * (1 - Math.exp(-speed * 0.016));

    let targetSpread = 0.0;
    let targetScale = 1.0;
    let targetRotX = 0;
    let targetRotY = time * BASE_ROTATION_SPEED;
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

    materialRef.current.uniforms.uGestureSpread.value = damp(
      materialRef.current.uniforms.uGestureSpread.value,
      targetSpread,
      14.0
    );
    materialRef.current.uniforms.uGestureScale.value = damp(
      materialRef.current.uniforms.uGestureScale.value,
      targetScale,
      10.0
    );

    pointsRef.current.rotation.x = damp(
      pointsRef.current.rotation.x,
      targetRotX,
      8.0
    );
    pointsRef.current.rotation.y = damp(
      pointsRef.current.rotation.y,
      targetRotY,
      8.0
    );
    pointsRef.current.rotation.z = damp(
      pointsRef.current.rotation.z,
      targetRotZ,
      7.0
    );

    if (!Number.isFinite(materialRef.current.uniforms.uSize.value)) {
      materialRef.current.uniforms.uSize.value = config.size;
    }
    if (!Number.isFinite(materialRef.current.uniforms.uNoiseStrength.value)) {
      materialRef.current.uniforms.uNoiseStrength.value = config.noise;
    }
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: config.size },
      uColor: { value: new THREE.Color(config.color) },
      uGestureScale: { value: 1.0 },
      uGestureSpread: { value: 0.0 },
      uNoiseStrength: { value: config.noise },
      uMouse: { value: new THREE.Vector3(999, 999, 999) },
      uBeatSignal: { value: 0.0 },
      uMorphFactor: { value: 1.0 },
    }),
    []
  );

  return (
    <points ref={pointsRef} position={[0, 0, 0]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-currentPosition"
          count={count}
          array={currentPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-targetPosition"
          count={count}
          array={targetPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          count={count}
          array={seeds}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={currentPositions}
          itemSize={3}
        />
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
    shape: "sphere",
    color: "#00f3ff",
    size: 2.0,
    noise: 0.45,
    count: 8000,
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [handCoords, setHandCoords] = useState([]);
  const [audioSrc, setAudioSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const gestureController = useRef();
  const gestureState = useRef({
    hasHands: false,
    spread: 0,
    scale: 1,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    hands: [],
  });
  const videoRef = useRef();
  const audioRef = useRef(new Audio());
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const sourceRef = useRef(null);

  // Lyrics State
  const [lyrics, setLyrics] = useState("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [lyricsReady, setLyricsReady] = useState(false);
  const [songInput, setSongInput] = useState({ title: "", artist: "" });
  const lyricsScrollRef = useRef(null);
  const [micPanelOpen, setMicPanelOpen] = useState(false);
  const micButtonRef = useRef(null);
  const micPanelRef = useRef(null);
  const [lyricsTooltipVisible, setLyricsTooltipVisible] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micSensitivity, setMicSensitivity] = useState(0.5);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const micAnalyserRef = useRef(null);
  const micDataArrayRef = useRef(null);
  const micStreamRef = useRef(null);
  const micLevelRef = useRef(0);
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);
  const audioButtonRef = useRef(null);
  const audioPanelRef = useRef(null);
  const audioFileInputRef = useRef(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [audioReady, setAudioReady] = useState(false);

  const handleGenerateLyrics = async () => {
    const title = songInput.title.trim();
    const artist = songInput.artist.trim();
    if (!title || !artist) {
      setLyrics("Lyrics not found. Please check song title and artist.");
      setLyricsReady(false);
      return;
    }
    setLyricsLoading(true);
    setLyrics("");
    try {
      const text = await fetchLyrics(title, artist);
      if (text && text.trim()) {
        setLyrics(text.trim());
        setLyricsReady(true);
      } else {
        setLyrics("Lyrics not found. Please check song title and artist.");
        setLyricsReady(false);
      }
    } catch (err) {
      console.error(err);
      setLyrics("Lyrics not found. Please check song title and artist.");
      setLyricsReady(false);
    } finally {
      setLyricsLoading(false);
    }
  };

  useEffect(() => {
    // Explicitly do not auto-open lyrics; user toggles via icon
  }, []);

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
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      if (audioRef.current && !sourceRef.current) {
        sourceRef.current = audioContextRef.current.createMediaElementSource(
          audioRef.current
        );
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      initAudio();
      const url = URL.createObjectURL(file);
      setAudioSrc(url);
      audioRef.current.src = url;
      setUploadedFileName(file.name);
      setIsPlaying(false);
      setAudioReady(true);
    }
  };

  const toggleAudio = async () => {
    if (!audioSrc) {
      return;
    }
    initAudio();
    if (audioRef.current.paused) {
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        try {
          await audioContextRef.current.resume();
        } catch {}
      }
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const startMic = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      } else if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;
      micAnalyserRef.current = audioContextRef.current.createAnalyser();
      micAnalyserRef.current.fftSize = 256;
      const bufferLength = micAnalyserRef.current.fftSize;
      micDataArrayRef.current = new Uint8Array(bufferLength);
      const micSource =
        audioContextRef.current.createMediaStreamSource(stream);
      micSource.connect(micAnalyserRef.current);
      setMicPermissionDenied(false);
      setMicEnabled(true);
    } catch (err) {
      console.warn("Mic permission denied or unavailable", err);
      setMicPermissionDenied(true);
      setMicEnabled(false);
    }
  };

  const stopMic = () => {
    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      micAnalyserRef.current = null;
      micDataArrayRef.current = null;
    } finally {
      setMicEnabled(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!micPanelOpen) return;
      const target = e.target;
      if (
        micPanelRef.current &&
        !micPanelRef.current.contains(target) &&
        micButtonRef.current &&
        !micButtonRef.current.contains(target)
      ) {
        setMicPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [micPanelOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!audioPanelOpen) return;
      const target = e.target;
      if (
        audioPanelRef.current &&
        !audioPanelRef.current.contains(target) &&
        audioButtonRef.current &&
        !audioButtonRef.current.contains(target)
      ) {
        setAudioPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [audioPanelOpen]);

  useEffect(() => {
    if (videoRef.current && !gestureController.current) {
      gestureController.current = new GestureController(videoRef.current);
    }
  }, []);

  useEffect(() => {
    let raf;
    const update = () => {
      if (cameraActive && gestureController.current) {
        gestureController.current.update();
        gestureState.current = gestureController.current.getState();
        setHandCoords(gestureState.current.hands || []);
      } else {
        gestureState.current.hasHands = false;
        setHandCoords([]);
      }
      raf = requestAnimationFrame(update);
    };
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
      <div className="fixed top-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-b from-black/20 to-transparent z-30">
        <div className="h-full px-6 flex items-center">
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-black tracking-tight text-white">
              PARTICLEX
            </span>
            <span className="text-[10px] font-mono tracking-[0.35em] text-cyan-300/70">
              SYS v2.1 • ONLINE
            </span>
          </div>
          <div className="ml-auto pointer-events-auto relative flex items-center gap-2" ref={micButtonRef}>
            <button
              onClick={() => setMicPanelOpen((v) => !v)}
              className={`w-7 h-7 rounded-md transition-all ${
                micPanelOpen ? "text-cyan-300" : "text-white/60 hover:text-white"
              }`}
              aria-label="Lyrics"
              title="Lyrics"
            >
              <Mic size={16} />
            </button>
            <button
              onClick={() => {
                setShowLyricsPanel((v) => !v);
              }}
              className={`w-7 h-7 rounded-md transition-all ${
                showLyricsPanel ? "text-cyan-300" : "text-white/60 hover:text-white"
              }`}
              aria-label="Lyrics Overlay"
              title="Lyrics Overlay"
            >
              <FileText size={16} />
            </button>
          </div>
        </div>
      </div>
      {micPanelOpen && (
        <div
          ref={micPanelRef}
          className="fixed right-6 top-12 z-40 w-[260px] max-w-[260px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/70">Mic Input</span>
            <button
              onClick={async () => {
                if (micEnabled) {
                  stopMic();
                } else {
                  await startMic();
                }
              }}
              className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider ${
                micEnabled
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {micEnabled ? "ON" : "OFF"}
            </button>
          </div>
          <div className="mb-2">
            <label className="text-[10px] text-white/60 block mb-1">
              Mic Sensitivity
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={micSensitivity}
              onChange={(e) => setMicSensitivity(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="text-[10px] text-white/50">
            {micPermissionDenied
              ? "Mic permission denied"
              : micEnabled
              ? "Mic Active"
              : "Mic Inactive"}
          </div>
        </div>
      )}
      <div className="fixed left-0 top-0 h-full w-14 z-30">
        <div className="h-full flex flex-col items-center justify-center gap-3 relative">
          <button
            onClick={() => setConfig((prev) => ({ ...prev, shape: "sphere" }))}
            className={`w-10 h-10 rounded-lg transition-all border ${
              config.shape === "sphere"
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Sphere"
            title="Sphere"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Globe size={18} />
            </div>
          </button>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, shape: "saturn" }))}
            className={`w-10 h-10 rounded-lg transition-all border ${
              config.shape === "saturn"
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Saturn"
            title="Saturn"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Globe size={18} />
            </div>
          </button>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, shape: "heart" }))}
            className={`w-10 h-10 rounded-lg transition-all border ${
              config.shape === "heart"
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Heart"
            title="Heart"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Heart size={18} />
            </div>
          </button>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, shape: "flower" }))}
            className={`w-10 h-10 rounded-lg transition-all border ${
              config.shape === "flower"
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Flower"
            title="Flower"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Flower2 size={18} />
            </div>
          </button>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, shape: "fireworks" }))}
            className={`w-10 h-10 rounded-lg transition-all border ${
              config.shape === "fireworks"
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Fireworks"
            title="Fireworks"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles size={18} />
            </div>
          </button>
          <button
            ref={audioButtonRef}
            onClick={() => setAudioPanelOpen((v) => !v)}
            className={`w-10 h-10 rounded-lg transition-all border ${
              audioPanelOpen
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
            aria-label="Audio"
            title="Audio"
          >
            <div className="w-full h-full flex items-center justify-center">
              <Music size={18} />
            </div>
          </button>
          {audioPanelOpen && (
            <div
              ref={audioPanelRef}
              className="fixed left-16 top-1/2 -translate-y-1/2 z-40 w-[260px] max-w-[260px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
            >
              <div className="mb-2">
                <span className="text-[10px] text-white/70">Audio Upload</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => audioFileInputRef.current && audioFileInputRef.current.click()}
                  className="px-2 py-1 rounded-md text-[10px] font-bold tracking-wider bg-white/10 text-white/70 hover:bg-white/15"
                >
                  Upload File
                </button>
                <span className="text-[10px] text-white/50 truncate max-w-[120px]">
                  {uploadedFileName || "No file selected"}
                </span>
              </div>
              <div className="mb-2">
                <input
                  type="text"
                  value={songInput.title}
                  onChange={(e) =>
                    setSongInput((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Song title"
                  className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/80 placeholder-white/40"
                />
              </div>
            <div className="mb-1">
              <input
                type="text"
                value={songInput.artist}
                onChange={(e) =>
                  setSongInput((prev) => ({ ...prev, artist: e.target.value }))
                }
                placeholder="Artist name"
                className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[12px] text-white/80 placeholder-white/40"
              />
            </div>
            <div className="mt-2">
              <button
                onClick={handleGenerateLyrics}
                disabled={
                  !songInput.title.trim() ||
                  !songInput.artist.trim() ||
                  lyricsLoading
                }
                className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider ${
                  !songInput.title.trim() ||
                  !songInput.artist.trim() ||
                  lyricsLoading
                    ? "bg-white/5 text-white/40 cursor-not-allowed"
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                }`}
              >
                {lyricsLoading ? "Generating..." : "Generate Lyrics"}
              </button>
            </div>
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-0">
        <Canvas camera={{ position: [0, 0, 9], fov: 55 }}>
          <color attach="background" args={["#050505"]} />
          <ParticleCloud
            config={config}
            gestureState={gestureState}
            analyser={analyserRef}
            dataArray={dataArrayRef}
          />
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              height={300}
              intensity={1.5}
            />
          </EffectComposer>
        </Canvas>
      </div>
      <div
        className={`fixed right-6 top-1/2 -translate-y-1/2 z-30 w-[320px] max-w-[320px] h-[70vh] transition-all duration-200 ease-out ${
          showLyricsPanel
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-4 pointer-events-none"
        }`}
      >
        <div className="h-full bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="text-left">
                <div className="text-sm font-bold text-white">{songInput.title}</div>
                <div className="text-[10px] text-white/50">{songInput.artist}</div>
              </div>
              <button
                onClick={() => {
                  setShowLyricsPanel(false);
                }}
                className="w-6 h-6 rounded-md text-white/60 hover:text-white transition-colors"
                aria-label="Close Lyrics"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div
              ref={lyricsScrollRef}
              className="flex-1 overflow-y-auto px-5 pb-6 scroll-smooth"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div className="text-center space-y-4 leading-relaxed">
                {lyricsReady && lyrics.trim() ? (
                  lyrics.split("\n").map((line, i) => (
                    <p
                      key={i}
                      className={`text-sm ${
                        line.trim() === ""
                          ? "h-4"
                          : "text-white/80 hover:text-cyan-300"
                      }`}
                    >
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-white/80">
                    Lyrics not generated yet. Use “Generate Lyrics” in the audio panel.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 flex items-center gap-4 md:gap-6">
        <button
          onClick={toggleAudio}
          className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wider transition-all ${
            isPlaying
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
              : "bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          {isPlaying ? "PAUSE" : "PLAY"}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/60">SIZE</span>
          <input
            type="range"
            min="0.5"
            max="8.0"
            step="0.1"
            value={config.size}
            onChange={(e) => setConfig((prev) => ({ ...prev, size: Number(e.target.value) }))}
            className="range-slider"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/60">CHAOS</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={config.noise}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                noise: Number(e.target.value),
              }))
            }
            className="range-slider"
          />
        </div>
        <div className="flex items-center gap-2">
          {[
            "#00f3ff",
            "#ffaa00",
            "#ff0055",
            "#39ff14",
            "#0066ff",
            "#8a2be2",
            "#ff4500",
            "#ffffff",
            "#ffff00",
            "#00ff99",
            "#ff00ff",
          ].map((c) => (
            <button
              key={c}
              onClick={() => setConfig((prev) => ({ ...prev, color: c }))}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                config.color === c
                  ? "scale-150 ring-2 ring-white ring-offset-2 ring-offset-black"
                  : "opacity-60 hover:opacity-100 hover:scale-125"
              }`}
              style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}60` }}
              aria-label="Color"
              title="Color"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
