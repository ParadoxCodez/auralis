import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class GestureController {
    constructor(videoElement) {
        this.video = videoElement;
        this.handLandmarker = undefined;
        this.running = false;
        this.lastVideoTime = -1;
        this.state = {
            scale: 1.0,
            spread: 0.0,
            rotationX: 0.0,
            rotationY: 0.0,
            rotationZ: 0.0,
            hasHands: false,
            isClosed: false,
            hands: []
        };

        // Smooth values to avoid jitter
        this.rawScale = 1.0;
        this.rawSpread = 0.0;
        this.rawRotX = 0.0;
        this.rawRotY = 0.0;
        this.rawRotZ = 0.0;
    }

    async initialize() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });
            console.log("HandLandmarker initialized");
        } catch (e) {
            console.error("Error initializing HandLandmarker", e);
        }
    }

    async startCamera() {
        if (!this.handLandmarker) await this.initialize();

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 }
                });
                this.video.srcObject = stream;
                this.video.addEventListener("loadeddata", () => {
                    this.running = true;
                }, { once: true });
            } catch (err) {
                console.error("Camera denied or error", err);
                alert("Camera access denied. Falling back to mouse controls.");
            }
        }
    }

    stopCamera() {
        this.running = false;
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        this.lastVideoTime = -1;
    }

    // Call once per frame from the main render loop (lower latency + no double RAF)
    update() {
        if (!this.running || !this.handLandmarker) return;

        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const results = this.handLandmarker.detectForVideo(this.video, performance.now());
            this.processResults(results);
        }
    }

    processResults(results) {
        if (results.landmarks && results.landmarks.length > 0) {
            this.state.hasHands = true;

            // 1. Calculate Open/Closed (Spread/Tension)
            // Check average distance from wrist (point 0) to tips (4, 8, 12, 16, 20)
            let totalOpenness = 0;
            let handCount = results.landmarks.length;

            for (const landmarks of results.landmarks) {
                const wrist = landmarks[0];
                const tips = [4, 8, 12, 16, 20];
                let avgDist = 0;
                for (let i of tips) {
                    const d = Math.sqrt(
                        Math.pow(landmarks[i].x - wrist.x, 2) +
                        Math.pow(landmarks[i].y - wrist.y, 2)
                    );
                    avgDist += d;
                }
                avgDist /= 5;
                // Heuristic: Closed fist ~0.15-0.2, Open hand ~0.35-0.5 (normalized coord space)
                // Map 0.2 -> 0.4 to 0 -> 1
                let openness = (avgDist - 0.2) * 5.0; // Simple mapping
                openness = Math.max(0, Math.min(1, openness));
                totalOpenness += openness;
            }
            totalOpenness /= handCount; // Average across hands

            // 2. Calculate Distance Scale (if 2 hands)
            // If 1 hand, maybe use x position or z-depth proxy?
            // Let's stick to 2 hands for scale, or default to 1.
            let distScale = 1.0;
            let targetRotX = 0.0;
            let targetRotY = 0.0;
            let targetRotZ = 0.0;

            if (handCount === 2) {
                const h1 = results.landmarks[0][0]; // Wrist 1
                const h2 = results.landmarks[1][0]; // Wrist 2
                const dx = (h2.x - h1.x);
                const dy = (h2.y - h1.y);
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Map distance to scale
                distScale = 0.55 + (dist - 0.12) * 2.1;

                // Rotation from hand centroid (simple + intuitive)
                const midX = (h1.x + h2.x) * 0.5;
                const midY = (h1.y + h2.y) * 0.5;

                targetRotY = (midX - 0.5) * 1.8;          // left/right
                targetRotX = (midY - 0.5) * -1.2;         // up/down
                targetRotZ = Math.atan2(dy, dx) * 0.45;   // twist (subtle)
            } else {
                // Single hand: rotate based on wrist position
                const h = results.landmarks[0][0];
                targetRotY = (h.x - 0.5) * 1.8;
                targetRotX = (h.y - 0.5) * -1.2;
                targetRotZ = 0.0;
            }

            // Update Target State with Smoothing
            const lerp = (a, b, t) => a + (b - a) * t;

            this.rawSpread = lerp(this.rawSpread, totalOpenness, 0.2); // Spread -> Separation/Explosion
            this.rawScale = lerp(this.rawScale, distScale, 0.12);
            this.rawRotX = lerp(this.rawRotX, targetRotX, 0.18);
            this.rawRotY = lerp(this.rawRotY, targetRotY, 0.18);
            this.rawRotZ = lerp(this.rawRotZ, targetRotZ, 0.14);

            this.state.spread = this.rawSpread;
            this.state.scale = this.rawScale;
            this.state.rotationX = this.rawRotX;
            this.state.rotationY = this.rawRotY;
            this.state.rotationZ = this.rawRotZ;
            this.state.isClosed = this.rawSpread < 0.2; // Threshold for closed
            
            // 3. Store Hand Coordinates (Wrist)
            this.state.hands = results.landmarks.map(l => ({
                x: l[0].x,
                y: l[0].y,
                z: l[0].z
            }));

        } else {
            this.state.hasHands = false;
            this.state.hands = [];
            // Decay to neutral
            this.state.spread *= 0.95;
            if (Math.abs(this.state.scale - 1.0) > 0.01) {
                this.state.scale += (1.0 - this.state.scale) * 0.05;
            }
            this.state.rotationX *= 0.92;
            this.state.rotationY *= 0.92;
            this.state.rotationZ *= 0.90;
        }
    }

    getState() {
        return this.state;
    }
}
