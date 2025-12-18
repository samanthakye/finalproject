// --- HAND TRACKING & MEDIAPIPE ---
let hands = []; // Array to store hand data (landmarks, position, gesture)
let lerpFactor = 0.05; // Smoothing factor for hand movement
let video;
let mic, fft;

// --- CONFIGURATION ---
const spacing = 60; // Denser grid
const maxDotSizeBase = 30; // Base for largest dot size
const minDotSizeBase = 3; // Base for smallest dot size
let influenceRadius = 300; // Larger area of effect
const repulsionStrength = 2.5; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion

// Map finger count to visual properties (size and shade)
const FINGER_VISUALS_MAP = {
  'default': { sizeFactor: 0.5, shade: 100 }, // Default when no hand is detected
  '0': { sizeFactor: 0.2, shade: 50 }, // Fist: small, dark
  '1': { sizeFactor: 0.4, shade: 100 },
  '2': { sizeFactor: 0.6, shade: 150 },
  '3': { sizeFactor: 0.8, shade: 200 },
  '4': { sizeFactor: 1.0, shade: 220 },
  '5': { sizeFactor: 1.2, shade: 255 } // Open hand: large, bright (can exceed maxDotSizeBase)
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
    this.targetDiameter = maxDotSizeBase * FINGER_VISUALS_MAP['default'].sizeFactor;
    this.currentDiameter = this.targetDiameter;
    this.targetShade = FINGER_VISUALS_MAP['default'].shade;
    this.currentShade = this.targetShade;
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

    // --- Repulsion / Attraction from hands ---
    for (const hand of hands) {
      let d = dist(this.x, this.y, hand.x, hand.y);

      if (d < minHandDist) {
        minHandDist = d;
        closestHandGesture = hand.gesture;
      }
      
      let currentInfluenceRadius = influenceRadius;
      let interactionStrength = repulsionStrength;

      if (hand.gesture === '0') { // Fist
        currentInfluenceRadius *= 0.5; // Still a smaller influence radius
        interactionStrength = repulsionStrength; // Standard repulsion strength
      }
      
      if (d < currentInfluenceRadius) {
        let angle = atan2(this.y - hand.y, this.x - hand.x);
        let force = map(d, 0, currentInfluenceRadius, interactionStrength, 0);
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
    
    // --- Size and Shade based on closest hand's gesture ---
    const visualProps = FINGER_VISUALS_MAP[closestHandGesture] || FINGER_VISUALS_MAP['default'];
    this.targetDiameter = maxDotSizeBase * visualProps.sizeFactor;
    this.targetShade = visualProps.shade;

    this.currentDiameter = lerp(this.currentDiameter, this.targetDiameter, 0.1);
    this.currentShade = lerp(this.currentShade, this.targetShade, 0.1);

    // Further scale diameter based on distance to original position
    let distToOrigin = dist(this.x, this.y, this.originalX, this.originalY);
    let scaledDiameter = map(distToOrigin, 0, influenceRadius / 2, this.currentDiameter, minDotSizeBase);
    this.currentDiameter = constrain(scaledDiameter, minDotSizeBase, this.currentDiameter);
  }

  draw() {
    if (!this.isAlive) return; // Don't draw if not alive
    fill(this.currentShade);
    ellipse(this.x, this.y, this.currentDiameter, this.currentDiameter);
  }
}

function onResults(results) {
  hands = []; // Clear the hands array each frame
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      
      // --- Finger Counting Gesture Detection ---
      let extendedFingers = 0;
      // Landmark indices for fingertips and their base (MCP) joints
      const fingerTips = [4, 8, 12, 16, 20];
      const fingerMcps = [2, 5, 9, 13, 17];
      
      // A simple heuristic: check if the fingertip is "higher" (lower y-value) than its base joint.
      // This works reasonably well for a mostly upright hand.
      for (let j = 0; j < fingerTips.length; j++) {
        if (landmarks[fingerTips[j]].y < landmarks[fingerMcps[j]].y) {
          extendedFingers++;
        }
      }
      let currentGesture = extendedFingers.toString();
      
      // Use index finger tip (landmark 8) for interaction point, regardless of gesture
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

let appState = 'start'; // Can be 'start' or 'running'

function drawStartScreen() {
  background(0);
  cursor(ARROW);
  
  // --- Text Styling ---
  fill(255); // White text
  textFont('monospace');
  textAlign(CENTER, CENTER);
  
  // --- Title ---
  textSize(24);
  text("Interactive Dot Grid", width / 2, height / 4);

  // --- Controls Key ---
  textSize(16);
  textAlign(LEFT, TOP);
  // Using an array and join to avoid indentation issues with template literals
  const keyText = [
    'Hand Pose Controls:',
    '',
    '[ 0 Fingers (Fist) ]',
    'Black Hole: Attracts and destroys dots.',
    '',
    '[ 1-4 Fingers ]',
    'Interact: Changes dot size and brightness.',
    '',
    '[ 5 Fingers (Open Hand) ]',
    'Creator: Spawns new dots.'
  ].join('\n');
  
  textAlign(CENTER, CENTER);
  text(keyText, width / 2, height / 2);

  // --- Start Prompt ---
  textSize(18);
  // Blinking effect for the start text
  if (frameCount % 60 < 40) {
    text("Click anywhere to start", width / 2, height * 0.85);
  }
}

function runSimulation() {
  noCursor(); // Hide cursor during simulation
  // --- Creator Mode ---
  for (const hand of hands) {
    // With an open hand, have a chance to spawn new dots
    if (hand.gesture === '5' && random(1) < 0.2) {
      // Create a new dot at the hand's position (mirrored)
      dots.push(new Dot(width - hand.x, hand.y));
    }
  }

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

function draw() {
  if (appState === 'start') {
    drawStartScreen();
  } else if (appState === 'running') {
    runSimulation();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  dots = [];
  createGrid();
}

function mousePressed() {
  // Start the simulation and audio context on the first click
  if (appState === 'start') {
    appState = 'running';
    userStartAudio(); // Required to enable audio in browsers
  }
}
