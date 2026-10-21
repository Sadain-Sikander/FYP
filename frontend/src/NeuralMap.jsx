import React, { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";

// Local, decorative animation. No external images, tracking, or model requests.
export default function NeuralMap({
  labels = [],
  active = 0,
  compact = false,
}) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame;
    let width = 0;
    let height = 0;
    let phase = 0;
    let inView = false;
    const points = Array.from({ length: 64 }, (_, index) => {
      const y = 1 - (index / 63) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    });
    function draw() {
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.34;
      const projected = points.map(([x, y, z]) => {
        const px = x * Math.cos(phase) - z * Math.sin(phase);
        const pz = x * Math.sin(phase) + z * Math.cos(phase);
        return [
          width / 2 + px * radius,
          height / 2 + y * radius * 0.87 + pz * radius * 0.17,
          pz,
        ];
      });
      projected.forEach(([x, y, z], i) => {
        for (let j = i + 1; j < projected.length; j++) {
          const [tx, ty, tz] = projected[j];
          const distance = Math.hypot(
            ...points[i].map((n, axis) => n - points[j][axis]),
          );
          if (distance < 0.53) {
            context.strokeStyle = `rgba(98, 169, 255, ${0.05 + ((z + tz + 2) / 4) * 0.22})`;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(tx, ty);
            context.stroke();
          }
        }
        context.fillStyle = `rgba(${i % 4 ? "130, 177, 255" : "157, 244, 214"}, ${0.25 + (z + 1) * 0.35})`;
        context.beginPath();
        context.arc(x, y, z > 0.4 ? 2.3 : 1.3, 0, Math.PI * 2);
        context.fill();
      });
    }
    function animate() {
      phase += 0.0025;
      draw();
      frame = requestAnimationFrame(animate);
    }
    function restart() {
      cancelAnimationFrame(frame);
      draw();
      if (!motion.matches && !document.hidden && inView && width && height)
        frame = requestAnimationFrame(animate);
    }
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      restart();
    });
    observer.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      restart();
    });
    visibilityObserver.observe(canvas);
    motion.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
  }, []);
  return (
    <div
      className={`neural-map ${compact ? "compact-map" : ""}`}
      aria-hidden="true"
    >
      <div className="neural-halo" />
      <div className="neural-ring ring-one" />
      <div className="neural-ring ring-two" />
      <canvas ref={canvasRef} className="neural-canvas" />
      <div className="neural-core">
        <Sparkles size={27} />
        <span>YOU</span>
      </div>
      {labels.slice(0, 4).map((label, index) => (
        <div
          className={`map-node map-node-${index} ${active === index ? "node-active" : ""}`}
          key={`${index}-${label}`}
        >
          <span className="node-dot" />
          {label}
        </div>
      ))}
      <span className="map-coordinate coordinate-top">POSSIBILITY / ∞</span>
      <span className="map-coordinate coordinate-bottom">
        CONNECTING THE DOTS
      </span>
    </div>
  );
}
