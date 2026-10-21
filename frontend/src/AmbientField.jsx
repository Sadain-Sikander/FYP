import React, { useEffect, useRef } from "react";

// A locally rendered flowing thread field. It pauses offscreen and for reduced motion.
export default function AmbientField({ phase = 0, paused = false }) {
  const canvasRef = useRef(null);
  const target = useRef(phase);
  const pauseRef = useRef(paused);
  const refresh = useRef(() => {});
  useEffect(() => {
    target.current = phase;
    refresh.current();
  }, [phase]);
  useEffect(() => {
    pauseRef.current = paused;
    refresh.current();
  }, [paused]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      tick = 0,
      current = target.current,
      frame;
    let visible = false;
    let pointer = { x: 0, y: 0 },
      smooth = { x: 0, y: 0 };
    function draw() {
      ctx.clearRect(0, 0, width, height);
      current += (target.current - current) * 0.035;
      smooth.x += (pointer.x - smooth.x) * 0.025;
      smooth.y += (pointer.y - smooth.y) * 0.025;
      const travel = reduced.matches ? 0 : Math.sin(tick * 0.23) * 0.06;
      for (let group = 0; group < 2; group++) {
        ctx.save();
        if (group) {
          ctx.translate(width, height);
          ctx.rotate(Math.PI);
        }
        for (let i = 0; i < 46; i++) {
          const strand = i / 45;
          const offset = strand * height * 0.24;
          const sway =
            Math.sin(tick * 0.32 + strand * 2.4 + current * 0.3) *
            height *
            0.035;
          ctx.beginPath();
          ctx.moveTo(-width * 0.12, height * 0.1 + offset);
          ctx.bezierCurveTo(
            width * (0.02 + travel),
            height * 0.7 + offset + sway,
            width * (0.37 + current * 0.015) + smooth.x * 20,
            height * (0.94 - strand * 0.06) + smooth.y * 15,
            width * 0.7,
            height * 1.2 + offset,
          );
          ctx.strokeStyle = `rgba(${group ? "166,192,137" : "210,247,164"},${0.035 + Math.sin(strand * Math.PI) * 0.15})`;
          ctx.lineWidth = i % 9 === 0 ? 1.2 : 0.6;
          ctx.stroke();
        }
        ctx.restore();
      }
      // Slow pinpricks give the field depth without drawing attention from the prompt.
      for (let i = 0; i < 24; i++) {
        const x = ((i * 0.618033 + tick * 0.0015) % 1) * width;
        const y =
          ((i * 0.381966 + Math.sin(tick * 0.18 + i) * 0.015) % 1) * height;
        ctx.fillStyle = `rgba(218,247,183,${0.09 + (0.13 * (Math.sin(tick + i) + 1)) / 2})`;
        ctx.beginPath();
        ctx.arc(x, y, i % 4 ? 0.8 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    function animate() {
      tick += 0.014;
      draw();
      frame = requestAnimationFrame(animate);
    }
    function restart() {
      cancelAnimationFrame(frame);
      if (reduced.matches) {
        current = target.current;
        smooth = { x: 0, y: 0 };
      }
      draw();
      if (
        !reduced.matches &&
        !pauseRef.current &&
        !document.hidden &&
        visible &&
        width &&
        height
      )
        frame = requestAnimationFrame(animate);
    }
    refresh.current = restart;
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      restart();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restart();
    });
    function move(event) {
      if (!reduced.matches)
        pointer = {
          x: event.clientX / innerWidth - 0.5,
          y: event.clientY / innerHeight - 0.5,
        };
    }
    resize.observe(canvas);
    intersection.observe(canvas);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
      refresh.current = () => {};
    };
  }, []);
  return (
    <div className="ambient-field" aria-hidden="true">
      <canvas className="ambient-canvas" ref={canvasRef} />
      <div className="ambient-vignette" />
    </div>
  );
}
