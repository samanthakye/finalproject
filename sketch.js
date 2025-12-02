// --- HAND TRACKING & MEDIAPIPE ---
let handX = 0; // X-coordinate for interaction
let handY = 0; // Y-coordinate for interaction
let lerpFactor = 0.1; // Smoothing factor for hand movement
let isHandOpen = false;

// --- CONFIGURATION ---
const spacing = 80; // Sparser grid
const maxDotDiameter = 20; // Smaller max size
const minDotDiameter = 2; // Smaller min size
const influenceRadius = 300; // Larger area of effect
const repulsionStrength = 0.8; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion
const DOT_COLOR = '#00FF00'; // Green
const OPEN_HAND_DOT_COLOR = '#FFFF00'; // Bright Yellow
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
    this.currentColor = color(DOT_COLOR); // Initialize with default color
  }

  update() {
    // Use smoothed handX/handY for interaction
    let targetX = handX;
    let targetY = handY;
    let d = dist(this.x, this.y, targetX, targetY);

    let currentInfluenceRadius = influenceRadius;
    let currentRepulsionStrength = repulsionStrength;

    if (isHandOpen) {
      currentInfluenceRadius *= 2.5;
      currentRepulsionStrength *= 3.5;
    }

    // --- Repulsion from mouse/hand ---
    if (d < currentInfluenceRadius) {
      let angle = atan2(this.y - targetY, this.x - targetX);
      let force = map(d, 0, currentInfluenceRadius, currentRepulsionStrength, 0);
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
    
    // --- Color change based on hand openness ---
    let targetColor = isHandOpen ? color(OPEN_HAND_DOT_COLOR) : color(DOT_COLOR);
    this.currentColor = lerpColor(this.currentColor, targetColor, 0.1);
  }

  draw() {
    fill(this.currentColor);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    // Calculate hand openness
    const thumbTip = landmarks[4];
    const pinkyTip = landmarks[20];
    const handOpenness = dist(thumbTip.x, thumbTip.y, pinkyTip.x, pinkyTip.y);
    
    if (handOpenness > 0.4) {
      isHandOpen = true;
    } else {
      isHandOpen = false;
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
    isHandOpen = false;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  noCursor();

  // Set initial interaction point to center of screen
  handX = width / 2;
  handY = height / 2;

  createGrid();

  const videoElement = document.querySelector('.input_video');
  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(onResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720
  });
  camera.start();
}


function createGrid() {
  dots = [];
  const numberOfDots = 2000; // A lot more dots for cosmic dust effect

  for (let i = 0; i < numberOfDots; i++) {
    let x = random(width);
    let y = random(height);
    dots.push(new Dot(x, y));
  }
}

function draw() {
  translate(width, 0);
  scale(-1, 1);
  background('#F5F5F5'); // Off-white background

  // Update and draw all dots
  for (let dot of dots) {
    dot.update();
    dot.draw();
  }
  
  // Optional: Draw a circle at the interaction point for debugging
  // fill(255, 0, 0, 100);
  // ellipse(handX, handY, 30, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  dots = [];
  createGrid();
}
