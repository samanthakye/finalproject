// --- HAND TRACKING & MEDIAPIPE ---
let hands = []; // Array to store hand data (landmarks, position, gesture)
let lerpFactor = 0.05; // Smoothing factor for hand movement
let video;
let mic, fft;

// --- CONFIGURATION ---
const spacing = 60; // Denser grid
const maxDotDiameter = 30; // Slightly smaller max size
const minDotDiameter = 3; // Slightly smaller min size
let influenceRadius = 300; // Larger area of effect
const repulsionStrength = 2.5; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion
const GESTURE_COLORS = {
  'default': '#00FF00',      // Green
  'open': '#FFA500',         // Orange
  'fist': '#FF00FF',         // Magenta
  'pointing': '#00FFFF'      // Cyan
};
let dots = [];

class Dot {
  constructor(x, y) {
    this.originalX = x;
    this.originalY = y;
    this.x = x;
    this.y = y;
    this.vx = 0; // Velocity x
    this.vy = 0; // Velocity y
    this.diameter = maxDotDiameter;
    this.currentColor = color(GESTURE_COLORS['default']); // Initialize with default color
  }

  update() {
    // --- Floating effect ---
    let noiseFactor = 0.005;
    let noiseAngle = noise(this.x * noiseFactor, this.y * noiseFactor, frameCount * 0.01) * TWO_PI;
    let noiseForce = 0.1;
    this.vx += cos(noiseAngle) * noiseForce;
    this.vy += sin(noiseAngle) * noiseForce;

    let closestHandGesture = 'default';
    let minHandDist = Infinity;

    // --- Repulsion from hands ---
    for (const hand of hands) {
      let d = dist(this.x, this.y, hand.x, hand.y);

      if (d < minHandDist) {
        minHandDist = d;
        closestHandGesture = hand.gesture;
      }
      
      let currentInfluenceRadius = influenceRadius;
      let currentRepulsionStrength = repulsionStrength;

      if (hand.gesture === 'open') {
        currentInfluenceRadius *= 2.5;
        currentRepulsionStrength *= 3.5;
      } else if (hand.gesture === 'fist') {
        currentInfluenceRadius *= 0.5;
        currentRepulsionStrength *= 0.5;
      }
      
      if (d < currentInfluenceRadius) {
        let angle = atan2(this.y - hand.y, this.x - hand.x);
        let force = map(d, 0, currentInfluenceRadius, currentRepulsionStrength, 0);
        this.vx += cos(angle) * force;
        this.vy += sin(angle) * force;
      }
    }

    // --- Spring back to origin ---
    let dx = this.originalX - this.x;
    let dy = this.originalY - this.y;
    this.vx += dx * springStiffness;
    this.vy += dy * springStiffness;

    // Apply damping
    this.vx *= damping;
    this.vy *= damping;

    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // --- Size based on distance to original position ---
    let distToOrigin = dist(this.x, this.y, this.originalX, this.originalY);
    this.diameter = map(distToOrigin, 0, influenceRadius / 2, maxDotDiameter, minDotDiameter);
    this.diameter = constrain(this.diameter, minDotDiameter, maxDotDiameter);
    
    // --- Color change based on the closest hand's gesture ---
    let targetColor = color(GESTURE_COLORS[closestHandGesture] || GESTURE_COLORS['default']);
    this.currentColor = lerpColor(this.currentColor, targetColor, 0.1);
  }

  draw() {
    fill(this.currentColor);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}

function onResults(results) {
  hands = []; // Clear the hands array each frame
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      
      // --- Gesture Detection ---
      const isIndexExtended = landmarks[8].y < landmarks[6].y;
      const isMiddleExtended = landmarks[12].y < landmarks[10].y;
      const isRingExtended = landmarks[16].y < landmarks[14].y;
      const isPinkyExtended = landmarks[20].y < landmarks[18].y;
      const allFingersExtended = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;

      let currentGesture;
      if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        currentGesture = 'pointing';
      } else if (allFingersExtended) {
        currentGesture = 'open';
      } else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
        currentGesture = 'fist';
      } else {
        currentGesture = 'default';
      }
      
      // Use index finger tip (landmark 8) for interaction
      const keypoint = landmarks[8];
      // Convert normalized coordinates to pixel coordinates
      let targetX = keypoint.x * width;
      let targetY = keypoint.y * height;

      // Find if this hand already exists to smooth its movement
      let existingHand = hands[i];
      if (!existingHand) {
        existingHand = { x: targetX, y: targetY };
      }

      // Smooth the interaction point using lerp
      let handData = {
        landmarks: landmarks,
        x: lerp(existingHand.x, targetX, lerpFactor),
        y: lerp(existingHand.y, targetY, lerpFactor),
        gesture: currentGesture
      };
      hands[i] = handData;
    }
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  noCursor();

  createGrid();

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onResults);

  const camera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: 640,
    height: 480
  });
  camera.start();

  // Initialize audio input
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  fft.setInput(mic);
}


function createGrid() {
  dots = [];
  const cols = floor(width / spacing);
  const rows = floor(height / spacing);
  const offsetX = (width - cols * spacing) / 2 + spacing / 2;
  const offsetY = (height - rows * spacing) / 2 + spacing / 2;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * spacing + offsetX;
      let y = j * spacing + offsetY;
      dots.push(new Dot(x, y));
    }
  }
}

function drawHandLandmarks() {
  for (const hand of hands) {
    if (hand.landmarks) {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index finger
        [9, 10], [10, 11], [11, 12], // Middle finger (connecting to palm via 0)
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring finger
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky finger
        [5, 9], [9, 13], [13, 17] // Palm base connections
      ];

      // Draw connections
      stroke(255, 0, 0); // Red lines
      strokeWeight(2);
      for (let connection of connections) {
        const p1 = hand.landmarks[connection[0]];
        const p2 = hand.landmarks[connection[1]];
        line(p1.x * width, p1.y * height, p2.x * width, p2.y * height);
      }

      // Draw landmarks
      noStroke();
      fill(0, 255, 0); // Green dots
      for (let landmark of hand.landmarks) {
        ellipse(landmark.x * width, landmark.y * height, 10, 10);
      }
    }
  }
}

function draw() {
  // Map microphone volume to influence radius
  let volume = mic.getLevel();
  // Map volume (0-1) to a larger radius. Use 0.3 as a high water mark for sensitivity.
  influenceRadius = map(volume, 0, 0.3, 150, 600);
  influenceRadius = constrain(influenceRadius, 150, 600);

  // --- Audio Hallucination ---
  if (frameCount % 200 < 5) { // Occasionally pulse
    influenceRadius = 600;
  }


  background(0); // Solid black background

  // Draw the dots first, applying the mirroring transformations
  push(); // Save the state before dot mirroring
  translate(width, 0);
  scale(-1, 1);

  // Update and draw all dots
  for (let dot of dots) {
    dot.update();
    dot.draw();
  }

  drawHandLandmarks(); // Draw the hand skeleton on top of the dots

  pop(); // Restore the original state

  if (video) {
    // Draw webcam feed in upper left corner, mirrored, on top of everything
    let webcamW = 160;
    let webcamH = 120;
    push();
    translate(webcamW, 0); // Move to the right edge of the video rectangle
    scale(-1, 1); // Flip horizontally
    image(video, 0, 0, webcamW, webcamH);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  dots = [];
  createGrid();
}
