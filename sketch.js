// --- CONFIGURATION ---
const spacing = 35; // Increased spacing for a less crowded feel
const maxDotDiameter = 25; // Slightly larger max size
const minDotDiameter = 3; // Slightly smaller min size
const influenceRadius = 200; // Larger area of effect
const repulsionStrength = 0.8; // How strongly the mouse pushes dots
const springStiffness = 0.05; // How quickly dots return to position
const damping = 0.85; // Easing for the spring motion

// Color Palette - A vibrant, mesmerizing selection
const PALETTE = ['#FF4B2B', '#FF416C', '#E54F6D', '#BE5A83', '#A166AB', '#7A6EBF', '#4F7DCB', '#2A8BBF', '#0097A7', '#00A896', '#4CAF50', '#8BC34A'];
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
    this.baseColor = random(PALETTE);
  }

  update() {
    let targetX = mouseX;
    let targetY = mouseY;
    let d = dist(this.x, this.y, targetX, targetY);

    // --- Repulsion from mouse ---
    if (d < influenceRadius) {
      let angle = atan2(this.y - targetY, this.x - targetX);
      // Force is stronger when closer
      let force = map(d, 0, influenceRadius, repulsionStrength, 0);
      this.vx += cos(angle) * force;
      this.vy += sin(angle) * force;
    }

    // --- Spring back to origin ---
    let dx = this.originalX - this.x;
    let dy = this.originalY - this.y;
    this.vx += dx * springStiffness;
    this.vy += dy * springStiffness;

    // Apply damping to slow it down
    this.vx *= damping;
    this.vy *= damping;

    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // --- Size and Color based on distance to original position ---
    let distToOrigin = dist(this.x, this.y, this.originalX, this.originalY);

    // The farther it's pushed, the smaller and more colorful it gets
    this.diameter = map(distToOrigin, 0, influenceRadius / 2, maxDotDiameter, minDotDiameter);
    this.diameter = constrain(this.diameter, minDotDiameter, maxDotDiameter);
    
    // Add a subtle "breathing" effect to all dots
    let pulse = sin(frameCount * 0.05 + this.originalX * 0.1) * 2;
    this.diameter += pulse;
  }

  draw() {
    let distToOrigin = dist(this.x, this.y, this.originalX, this.originalY);
    // Interpolate color based on how far the dot has been pushed
    let colorIndex = floor(map(distToOrigin, 0, influenceRadius / 3, 0, PALETTE.length));
    colorIndex = constrain(colorIndex, 0, PALETTE.length - 1);
    let c = color(PALETTE[colorIndex]);
    
    fill(c);
    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  rectMode(CENTER);
  colorMode(HSB, 360, 100, 100, 100);

  // Recalculate dots on setup
  createGrid();
}

function createGrid() {
  dots = []; // Clear existing dots
  // Adjust grid to be centered
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
  background(255); // White background
  for (let dot of dots) {
    dot.update();
    dot.draw();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  createGrid(); // Recreate the grid with new dimensions
}