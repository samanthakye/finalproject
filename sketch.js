// --- CONFIGURATION ---
const rows = 20; // Number of rows in the grid
const cols = 20; // Number of columns in the grid
const spacing = 30; // Spacing between the center of each dot
const maxDotDiameter = 20; // Maximum size of a dot
const minDotDiameter = 2; // Minimum size of a dot
const influenceRadius = 150; // The radius within which the mouse/hand affects dot size
const DOT_COLOR = '#207FFF'; // Electric Blue

let canvasWidth;
let canvasHeight;

function setup() {
  canvasWidth = cols * spacing + 100;
  canvasHeight = rows * spacing + 100;

  // Create the canvas and attach it to the 'canvas-container' in index.html
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');

  noStroke(); // Dots don't need an outline
  fill(DOT_COLOR);
  rectMode(CENTER);
}

function draw() {
  background(240); // Light gray background (same as in style.css)

  // Use the mouse position as the point of influence
  let targetX = mouseX;
  let targetY = mouseY;

  // Loop through the grid
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // Calculate the center position of the current dot
      let dotX = map(i, 0, cols - 1, spacing * 2, canvasWidth - spacing * 2);
      let dotY = map(j, 0, rows - 1, spacing * 2, canvasHeight - spacing * 2);

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

// NOTE: To enable hand tracking, you must integrate the ml5.js Handpose model
// and replace 'targetX = mouseX;' with the detected hand coordinates, as shown
// in the comprehensive code I provided in the previous turn.