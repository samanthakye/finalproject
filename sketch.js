// --- CONFIGURATION ---
const spacing = 30; // Spacing between the center of each dot
const maxDotDiameter = 20; // Maximum size of a dot
const minDotDiameter = 2; // Minimum size of a dot
const influenceRadius = 150; // The radius within which the mouse affects dot size
const DOT_COLOR = '#000000'; // Black

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke(); // Dots don't need an outline
  fill(DOT_COLOR);
  rectMode(CENTER);
}

function draw() {
  background(255); // White background

  const cols = floor(width / spacing);
  const rows = floor(height / spacing);

  // Use the mouse position as the point of influence
  let targetX = mouseX;
  let targetY = mouseY;

  // Loop through the grid
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // Calculate the center position of the current dot
      let dotX = i * spacing + spacing / 2;
      let dotY = j * spacing + spacing / 2;

      // 1. Calculate the distance between the current dot and the influence point
      let d = dist(dotX, dotY, targetX, targetY);

      // 2. Determine the size of the dot based on this distance
      let dotDiameter;

      if (d < influenceRadius) {
        // Inverse mapping: Closer the dot is (d=0), the smaller the diameter (minDotDiameter)
        dotDiameter = map(d, 0, influenceRadius, minDotDiameter, maxDotDiameter);
      } else {
        // Outside the sphere of influence, the dot is full size
        dotDiameter = maxDotDiameter;
      }

      // Ensure diameter is within bounds
      dotDiameter = constrain(dotDiameter, minDotDiameter, maxDotDiameter);

      // 3. Draw the dot
      ellipse(dotX, dotY, dotDiameter, dotDiameter);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}