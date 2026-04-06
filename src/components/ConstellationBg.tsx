import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  pulse: number;
  pulseSpeed: number;
  hue: number;
  depth: number; // 0-1 for parallax layers
}

interface AuroraWave {
  offset: number;
  speed: number;
  amplitude: number;
  hue: number;
  alpha: number;
}

export default function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let auroraWaves: AuroraWave[] = [];
    let time = 0;
    let mouseX = -1000;
    let mouseY = -1000;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const CONNECT_DIST = 140;
    const COUNT = 55;
    const AURORA_WAVES = 4;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.offsetWidth * dpr;
      h = canvas!.offsetHeight * dpr;
      canvas!.width = w;
      canvas!.height = h;
    }

    function init() {
      resize();
      particles = [];

      // Create particles in 3 depth layers
      for (let i = 0; i < COUNT; i++) {
        const depth = Math.random();
        const speedScale = 0.15 + depth * 0.2;
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * speedScale,
          vy: (Math.random() - 0.5) * speedScale,
          r: (0.6 + depth * 1.8) * dpr,
          alpha: 0.15 + depth * 0.35,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.003 + Math.random() * 0.012,
          hue: 320 + Math.random() * 40, // 320-360 pink/magenta range
          depth,
        });
      }

      // Aurora waves
      auroraWaves = [];
      for (let i = 0; i < AURORA_WAVES; i++) {
        auroraWaves.push({
          offset: Math.random() * Math.PI * 2,
          speed: 0.0003 + Math.random() * 0.0006,
          amplitude: 0.08 + Math.random() * 0.12,
          hue: 330 + i * 12,
          alpha: 0.025 + Math.random() * 0.02,
        });
      }
    }

    function drawBackground() {
      // Rich gradient background
      const grad = ctx!.createLinearGradient(0, 0, w * 0.3, h);
      grad.addColorStop(0, '#fdf2f8');   // pink-50
      grad.addColorStop(0.3, '#fce7f3'); // pink-100
      grad.addColorStop(0.6, '#fdf2f8'); // pink-50
      grad.addColorStop(1, '#fae8ff');   // fuchsia-50 for subtle variation
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, w, h);

      // Subtle radial light in upper area
      const radGrad = ctx!.createRadialGradient(w * 0.5, h * 0.15, 0, w * 0.5, h * 0.15, h * 0.7);
      radGrad.addColorStop(0, 'rgba(251, 207, 232, 0.4)'); // pink-200
      radGrad.addColorStop(0.5, 'rgba(251, 207, 232, 0.1)');
      radGrad.addColorStop(1, 'rgba(251, 207, 232, 0)');
      ctx!.fillStyle = radGrad;
      ctx!.fillRect(0, 0, w, h);
    }

    function drawAurora() {
      for (const wave of auroraWaves) {
        ctx!.beginPath();
        const baseY = h * (0.2 + wave.amplitude);
        ctx!.moveTo(0, baseY);

        for (let x = 0; x <= w; x += 4) {
          const progress = x / w;
          const y = baseY +
            Math.sin(progress * 3 + time * wave.speed * 1000 + wave.offset) * h * wave.amplitude * 0.5 +
            Math.sin(progress * 5 + time * wave.speed * 700) * h * wave.amplitude * 0.25 +
            Math.cos(progress * 2 + time * wave.speed * 500 + wave.offset * 2) * h * wave.amplitude * 0.15;
          ctx!.lineTo(x, y);
        }

        ctx!.lineTo(w, h);
        ctx!.lineTo(0, h);
        ctx!.closePath();

        const auroraGrad = ctx!.createLinearGradient(0, baseY - h * 0.15, 0, baseY + h * 0.4);
        auroraGrad.addColorStop(0, `hsla(${wave.hue}, 70%, 80%, 0)`);
        auroraGrad.addColorStop(0.3, `hsla(${wave.hue}, 70%, 80%, ${wave.alpha})`);
        auroraGrad.addColorStop(0.6, `hsla(${wave.hue}, 60%, 85%, ${wave.alpha * 0.5})`);
        auroraGrad.addColorStop(1, `hsla(${wave.hue}, 60%, 90%, 0)`);
        ctx!.fillStyle = auroraGrad;
        ctx!.fill();
      }
    }

    function draw() {
      time += 0.016; // ~60fps delta

      drawBackground();
      drawAurora();

      const dist = CONNECT_DIST * dpr;

      // Update particles
      for (const p of particles) {
        const driftX = Math.sin(time * 0.5 + p.pulse) * 0.04 * (1 + p.depth);
        const driftY = Math.cos(time * 0.35 + p.pulse * 1.3) * 0.03 * (1 + p.depth);

        p.x += p.vx + driftX;
        p.y += p.vy + driftY;
        p.pulse += p.pulseSpeed;

        // Wrap
        if (p.x < -30) p.x = w + 30;
        if (p.x > w + 30) p.x = -30;
        if (p.y < -30) p.y = h + 30;
        if (p.y > h + 30) p.y = -30;

        // Mouse attraction — depth-scaled
        const mdx = mouseX * dpr - p.x;
        const mdy = mouseY * dpr - p.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 180 * dpr && md > 0) {
          const force = 0.008 * (1 + p.depth);
          p.vx += (mdx / md) * force;
          p.vy += (mdy / md) * force;
        }

        p.vx *= 0.997;
        p.vy *= 0.997;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.5) { p.vx *= 0.94; p.vy *= 0.94; }
      }

      // Draw connections — only between similar depth particles
      ctx!.lineCap = 'round';
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const depthDiff = Math.abs(particles[i].depth - particles[j].depth);
          if (depthDiff > 0.4) continue;

          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < dist) {
            const strength = 1 - d / dist;
            const avgDepth = (particles[i].depth + particles[j].depth) / 2;
            const alpha = strength * strength * (0.06 + avgDepth * 0.1);

            const grad = ctx!.createLinearGradient(
              particles[i].x, particles[i].y,
              particles[j].x, particles[j].y
            );
            grad.addColorStop(0, `hsla(${particles[i].hue}, 65%, 70%, ${alpha})`);
            grad.addColorStop(1, `hsla(${particles[j].hue}, 65%, 70%, ${alpha})`);

            ctx!.strokeStyle = grad;
            ctx!.lineWidth = (0.3 + strength * 0.6 + avgDepth * 0.4) * dpr;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw particles — back to front
      const sorted = [...particles].sort((a, b) => a.depth - b.depth);
      for (const p of sorted) {
        const pulseVal = Math.sin(p.pulse);
        const pulseAlpha = p.alpha + pulseVal * 0.1;
        const pulseR = p.r + pulseVal * 0.3 * dpr;

        // Soft outer glow
        const glowSize = pulseR * (4 + p.depth * 3);
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `hsla(${p.hue}, 70%, 75%, ${pulseAlpha * 0.2})`);
        gradient.addColorStop(0.35, `hsla(${p.hue}, 70%, 75%, ${pulseAlpha * 0.06})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 70%, 75%, 0)`);
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx!.fill();

        // Bright core
        const coreSize = pulseR * 1.2;
        const coreGrad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreSize);
        coreGrad.addColorStop(0, `hsla(${p.hue}, 85%, 90%, ${Math.min(pulseAlpha + 0.35, 0.85)})`);
        coreGrad.addColorStop(0.4, `hsla(${p.hue}, 75%, 72%, ${pulseAlpha + 0.1})`);
        coreGrad.addColorStop(1, `hsla(${p.hue}, 75%, 72%, 0)`);
        ctx!.fillStyle = coreGrad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, coreSize, 0, Math.PI * 2);
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas!.getBoundingClientRect();
      const touch = 'touches' in e ? e.touches[0] : e;
      if (touch) {
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
      }
    };

    const handleLeave = () => { mouseX = -1000; mouseY = -1000; };

    init();
    draw();
    window.addEventListener('resize', init);
    canvas.addEventListener('mousemove', handleMove as EventListener);
    canvas.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('touchmove', handleMove as EventListener, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', init);
      canvas.removeEventListener('mousemove', handleMove as EventListener);
      canvas.removeEventListener('mouseleave', handleLeave);
      canvas.removeEventListener('touchmove', handleMove as EventListener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full z-0"
    />
  );
}
