// Simulation parameters (normalized units)
const G = 100;
const M = 1000;
const dt = 0.1;

const BH_RADIUS = 32; // black hole radius in pixels

// Setup canvas
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dpr = window.devicePixelRatio || 1;
let center = { x: innerWidth / 2, y: innerHeight / 2 };
function resize() {
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // keep the BH center in sync with the window size
  if (typeof center !== "undefined") {
    center.x = innerWidth / 2;
    center.y = innerHeight / 2;
  }
}
addEventListener("resize", resize, false);
resize();

// UI elements
const resetBtn = document.getElementById("reset");
const toggleTraceBtn = document.getElementById("toggleTrace");
const toggleVelocityBtn = document.getElementById("toggleVelocity");
const toggleAccelBtn = document.getElementById("toggleAcceleration");

let traceOn = true;
toggleTraceBtn.onclick = () => {
  traceOn = !traceOn;
};

let velocityOn = false;
toggleVelocityBtn.onclick = () => {
  velocityOn = !velocityOn;
};

let accelOn = false;
toggleAccelBtn.onclick = () => {
  accelOn = !accelOn;
};

let particles = [];

// Particle (projectile) state
function resetParticle() {
  particles = [];
  clearCanvas();
}
resetBtn.onclick = resetParticle;

// Mouse interaction: click+drag to set position & velocity
let dragging = false;
let dragStart = null;
let previewPos = null;

canvas.addEventListener("mousedown", (e) => {
  // start projectile at mouse pos
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  previewPos = { ...dragStart };
});

canvas.addEventListener("mousemove", (e) => {
  if (dragging) previewPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("mouseup", (e) => {
  if (!dragging) return;
  dragging = false;
  const start = dragStart;
  const end = { x: e.clientX, y: e.clientY };
  const vscale = 0.05; // tweak
  const vx = (end.x - start.x) * vscale;
  const vy = (end.y - start.y) * vscale;

  particle = {
    x: start.x,
    y: start.y,
    vx: vx,
    vy: vy,
    ax: 0,
    ay: 0,
    trace: [],
  };
  particles.push(particle);
});

function clearCanvas() {
  ctx.fillStyle = "#1A1A1A";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
}

clearCanvas();

// compute gravitational acceleration at the particle's current position
// returns { ax, ay, r }
function acceleration(p) {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r === 0) {
    // avoid divide-by-zero; return zero acceleration
    return { ax: 0, ay: 0, r: 0 };
  }
  // For a test particle (mass=1) the acceleration magnitude is GM / r^2
  const aMag = (G * M) / (r * r);
  // acceleration vector points toward the BH center
  const ax = -aMag * (dx / r);
  const ay = -aMag * (dy / r);
  return { ax, ay, r };
}

// Velocity Verlet integrator (symplectic)
function stepVerlet(p, dt) {
  // compute a(t)
  const a0 = acceleration(p);
  p.ax = a0.ax;
  p.ay = a0.ay;
  // x(t+dt) = x + v*dt + 0.5*a*dt^2
  p.x += p.vx * dt + 0.5 * p.ax * dt * dt;
  p.y += p.vy * dt + 0.5 * p.ay * dt * dt;
  // compute a(t+dt)
  const a1 = acceleration(p);
  // v(t+dt) = v + 0.5*(a0 + a1)*dt
  p.vx += 0.5 * (p.ax + a1.ax) * dt;
  p.vy += 0.5 * (p.ay + a1.ay) * dt;
  p.ax = a1.ax;
  p.ay = a1.ay;
  return a1.r;
}

// draw black hole
function drawBH() {
  const cx = center.x,
    cy = center.y;
  // glowing ring
  const grad = ctx.createRadialGradient(
    cx,
    cy,
    BH_RADIUS,
    cx,
    cy,
    BH_RADIUS * 10
  );
  grad.addColorStop(0, "rgba(255,98,0,0.9)");
  grad.addColorStop(0.5, "rgba(255,170,100,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, BH_RADIUS * 12, 0, Math.PI * 2);
  ctx.fill();
  // dark center
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(cx, cy, BH_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

// draw projectile
function drawParticle(p) {
  if (!p) return;
  // trace
  if (traceOn) {
    ctx.beginPath();
    for (let i = 0; i < p.trace.length; i++) {
      const t = p.trace[i];
      if (i === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; // white trace
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // particle
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// main loop
function animate(now) {
  // draw background & BH
  clearCanvas();
  drawBH();

  // draw preview if dragging
  if (dragging && dragStart && previewPos) {
    ctx.strokeStyle = "#8f8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dragStart.x, dragStart.y);
    ctx.lineTo(previewPos.x, previewPos.y);
    ctx.stroke();
    // small circle where projectile will start
    ctx.fillStyle = "#8f8";
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (particles.length > 0) {
    for (const particle of particles) {
      const r = stepVerlet(particle, dt);
      // record trace
      particle.trace.push({ x: particle.x, y: particle.y });
      if (particle.trace.length > 1200) particle.trace.shift();
      // swallow if inside black hole radius
      if (r < BH_RADIUS) {
        // particle swallowed
        particles.splice(particles.indexOf(particle), 1);
      }
      // also remove if offscreen far away
      if (
        particle &&
        (particle.x < -2000 ||
          particle.x > innerWidth + 2000 ||
          particle.y < -2000 ||
          particle.y > innerHeight + 2000)
      ) {
        particles.splice(particles.indexOf(particle), 1);
      }
    }
  }

  if (particles.length > 0 && velocityOn) {
    const vScale = 5; // visual scaling for the arrow
    for (const particle of particles) {
    ctx.strokeStyle = "rgba(80,200,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(
      particle.x + particle.vx * vScale,
      particle.y + particle.vy * vScale
    );
    ctx.stroke();
    // numeric readout
    const vMag = Math.sqrt(
      particle.vx * particle.vx + particle.vy * particle.vy
    );
    ctx.fillStyle = "#8ff";
    ctx.font = "12px Arial";
    ctx.fillText("v=" + vMag.toExponential(2), particle.x + 6, particle.y - 18);
    }
  }

  if (particles.length > 0 && accelOn) {
    const aScale = 20; // visual scaling for the arrow
    for (const particle of particles) {
      const acc = acceleration(particle);
      ctx.strokeStyle = "rgba(255,80,80,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x + acc.ax * aScale, particle.y + acc.ay * aScale);
      ctx.stroke();
      // numeric readout
      const aMag = Math.sqrt(acc.ax * acc.ax + acc.ay * acc.ay);
      ctx.fillStyle = "#f88";
      ctx.font = "12px Arial";
      ctx.fillText("a=" + aMag.toExponential(2), particle.x + 6, particle.y - 6);
    }
  }

  for (particle of particles) {
    drawParticle(particle);
  }

  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
