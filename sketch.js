// --- HAND TRACKING & MEDIAPIPE ---
let handX = 0; // X-coordinate for interaction
let handY = 0; // Y-coordinate for interaction
let lerpFactor = 0.1; // Smoothing factor for hand movement

// --- CONFIGURATION ---
const spacing = 50; // Increased spacing for a less crowded feel
const maxDotDiameter = 35; // Slightly larger max size
const minDotDiameter = 5; // Slightly smaller min size
const influenceRadius = 200; // Larger area of effect
const repulsionStrength = 0.8; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion
const DOT_COLOR = 255; // White
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
  }

  update() {
    // Use smoothed handX/handY for interaction
    let targetX = handX;
    let targetY = handY;
    let d = dist(this.x, this.y, targetX, targetY);

    // --- Repulsion from mouse/hand ---
    if (d < influenceRadius) {
      let angle = atan2(this.y - targetY, this.x - targetX);
      let force = map(d, 0, influenceRadius, repulsionStrength, 0);
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
    
    // Add "breathing" effect
    let pulse = sin(frameCount * 0.05 + this.originalX * 0.1) * 2;
    this.diameter += pulse;
  }

  draw() {
    fill(DOT_COLOR);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}

function onResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    let avgX = 0;
    let avgY = 0;
    landmarks.forEach(landmark => {
      avgX += landmark.x;
      avgY += landmark.y;
    });
    avgX /= landmarks.length;
    avgY /= landmarks.length;

    // Convert normalized coordinates to pixel coordinates
    let targetX = avgX * width;
    let targetY = avgY * height;

    // Smooth the interaction point using lerp
    handX = lerp(handX, targetX, lerpFactor);
    handY = lerp(handY, targetY, lerpFactor);
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
  translate(width, 0);
  scale(-1, 1);
  background('#222222'); // Dark gray background

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
