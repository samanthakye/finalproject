// --- HAND TRACKING & MEDIAPIPE ---
let handX = 0; // X-coordinate for interaction
let handY = 0; // Y-coordinate for interaction
let lerpFactor = 0.05; // Smoothing factor for hand movement
let isHandOpen = false;
let video;
let backgroundBuffer; // Graphics buffer for blurred background

// --- CONFIGURATION ---
const spacing = 60; // Denser grid
const maxDotDiameter = 30; // Slightly smaller max size
const minDotDiameter = 3; // Slightly smaller min size
const influenceRadius = 300; // Larger area of effect
const repulsionStrength = 2.5; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion
const DOT_COLOR = '#00FF00'; // Vibrant Green
const OPEN_HAND_DOT_COLOR = '#FFA500'; // Orange
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

function draw() {
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
