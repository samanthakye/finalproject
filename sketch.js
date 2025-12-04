// --- HAND TRACKING & MEDIAPIPE ---
let handX = 0; // X-coordinate for interaction
let handY = 0; // Y-coordinate for interaction
let lerpFactor = 0.05; // Smoothing factor for hand movement
let gesture = 'default';
let video;
let backgroundBuffer; // Graphics buffer for blurred background
let currentHandLandmarks = null; // Stores the latest hand landmarks for visualization
let mic, fft;

// --- UNCOMFORTABLE AI ---
let aiHandX, aiHandY;
let aiNoiseX = 1000;
let aiNoiseY = 2000;
let userRepulsion;
let aiRepulsion;

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
    // Use smoothed handX/handY for interaction
    let targetX = handX;
    let targetY = handY;
    let d = dist(this.x, this.y, targetX, targetY);

    // --- AI Hand Interaction ---
    let aiDist = dist(this.x, this.y, aiHandX, aiHandY);
    let aiInfluenceRadius = 150;

    let currentInfluenceRadius = influenceRadius;
    let currentRepulsionStrength = userRepulsion;

    if (gesture === 'open') {
      currentInfluenceRadius *= 2.5;
      currentRepulsionStrength *= 3.5;
    } else if (gesture === 'fist') {
      currentInfluenceRadius *= 0.5;
      currentRepulsionStrength *= 0.5;
    }

    // --- Floating effect ---
    let noiseFactor = 0.005;
    let noiseAngle = noise(this.x * noiseFactor, this.y * noiseFactor, frameCount * 0.01) * TWO_PI;
    let noiseForce = 0.1;
    this.vx += cos(noiseAngle) * noiseForce;
    this.vy += sin(noiseAngle) * noiseForce;

    // --- Repulsion from mouse/hand ---
    if (d < currentInfluenceRadius) {
      let angle = atan2(this.y - targetY, this.x - targetX);
      let force = map(d, 0, currentInfluenceRadius, currentRepulsionStrength, 0);
      this.vx += cos(angle) * force;
      this.vy += sin(angle) * force;
    }

    // --- Repulsion from AI hand ---
    if (aiDist < aiInfluenceRadius) {
      let angle = atan2(this.y - aiHandY, this.x - aiHandX);
      let force = map(aiDist, 0, aiInfluenceRadius, aiRepulsion, 0);
      this.vx += cos(angle) * force;
      this.vy += sin(angle) * force;
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
    
    // --- Color change based on gesture ---
    let targetColor = color(GESTURE_COLORS[gesture] || GESTURE_COLORS['default']);
    this.currentColor = lerpColor(this.currentColor, targetColor, 0.1);
  }

  draw() {
    fill(this.currentColor);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    currentHandLandmarks = results.multiHandLandmarks[0];
    const landmarks = currentHandLandmarks;
    
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

    // --- Unreliable Gesture ---
    if (frameCount % 100 < 10) { // Occasionally glitch
      let gestures = Object.keys(GESTURE_COLORS);
      gesture = random(gestures);
    } else {
      gesture = currentGesture;
    }

    // Use index finger tip (landmark 8) for interaction
    const keypoint = landmarks[8];
    // Convert normalized coordinates to pixel coordinates
    let targetX = keypoint.x * width;
    let targetY = keypoint.y * height;

    // Smooth the interaction point using lerp
    handX = lerp(handX, targetX, lerpFactor);
    handY = lerp(handY, targetY, lerpFactor);
  } else {
    gesture = 'default';
    currentHandLandmarks = null;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  noCursor();

  // Set initial interaction point to center of screen
  handX = width / 2;
  handY = height / 2;
  aiHandX = width / 2;
  aiHandY = height / 2;

  userRepulsion = repulsionStrength;
  aiRepulsion = 1.5;

  createGrid();

  backgroundBuffer = createGraphics(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
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
  if (currentHandLandmarks) {
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
      const p1 = currentHandLandmarks[connection[0]];
      const p2 = currentHandLandmarks[connection[1]];
      line(p1.x * width, p1.y * height, p2.x * width, p2.y * height);
    }

    // Draw landmarks
    noStroke();
    fill(0, 255, 0); // Green dots
    for (let landmark of currentHandLandmarks) {
      ellipse(landmark.x * width, landmark.y * height, 10, 10);
    }
  }
}

function draw() {
    // --- AI Hand Movement ---
  aiNoiseX += 0.005;
  aiNoiseY += 0.005;
  aiHandX = noise(aiNoiseX) * width;
  aiHandY = noise(aiNoiseY) * height;

  // --- Progressive Loss of Control ---
  // Over time, user has less control, and AI has more.
  // This happens over 30 seconds (1800 frames at 60fps)
  let controlShift = constrain(frameCount / 1800, 0, 1);
  userRepulsion = lerp(repulsionStrength, 0, controlShift);
  aiRepulsion = lerp(1.5, 4, controlShift);
  lerpFactor = lerp(0.05, 0.005, controlShift);


  // Map microphone volume to influence radius
  let volume = mic.getLevel();
  // Map volume (0-1) to a larger radius. Use 0.3 as a high water mark for sensitivity.
  influenceRadius = map(volume, 0, 0.3, 150, 600);
  influenceRadius = constrain(influenceRadius, 150, 600);

  // --- Audio Hallucination ---
  if (frameCount % 200 < 5) { // Occasionally pulse
    influenceRadius = 600;
  }


  background(0); // Clear main canvas

  if (video) {
    // Draw video onto buffer, mirrored
    backgroundBuffer.clear();
    backgroundBuffer.push();
    backgroundBuffer.translate(backgroundBuffer.width, 0);
    backgroundBuffer.scale(-1, 1);
    backgroundBuffer.image(video, 0, 0, backgroundBuffer.width, backgroundBuffer.height);
    backgroundBuffer.pop();

    backgroundBuffer.filter(BLUR, 5); // Blur the buffer

    image(backgroundBuffer, 0, 0); // Draw blurred buffer to main canvas
  }

  // Now, draw the dots. These should also be mirrored.
  // So, apply the mirroring transformations to the main canvas before drawing dots.
  push(); // Save the state before dot mirroring
  translate(width, 0);
  scale(-1, 1);

  drawHandLandmarks(); // Draw the hand skeleton

  // Update and draw all dots
  for (let dot of dots) {
    dot.update();
    dot.draw();
  }
  pop(); // Restore the original state
  
  // Optional: Draw a circle at the interaction point for debugging
  // fill(255, 0, 0, 100);
  // ellipse(handX, handY, 30, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (backgroundBuffer) {
    backgroundBuffer.resizeCanvas(windowWidth, windowHeight);
  }
  dots = [];
  createGrid();
}
