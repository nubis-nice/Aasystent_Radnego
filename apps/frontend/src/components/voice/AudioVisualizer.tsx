"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  size?: "sm" | "md" | "lg";
}

export function AudioVisualizer({
  audioLevel,
  isActive,
  size = "md",
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const dimensions = {
    sm: { width: 120, height: 40, bars: 20 },
    md: { width: 200, height: 60, bars: 32 },
    lg: { width: 300, height: 80, bars: 48 },
  }[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      if (!isActive) {
        ctx.fillStyle = "#cbd5e1";
        const barWidth = dimensions.width / dimensions.bars;
        for (let i = 0; i < dimensions.bars; i++) {
          const x = i * barWidth;
          const height = 4;
          const y = dimensions.height / 2 - height / 2;
          ctx.fillRect(x, y, barWidth - 2, height);
        }
        return;
      }

      const barWidth = dimensions.width / dimensions.bars;
      const maxBarHeight = dimensions.height * 0.8;

      for (let i = 0; i < dimensions.bars; i++) {
        const variation = Math.sin((Date.now() / 200 + i) * 0.5) * 0.3;
        const normalizedLevel = (audioLevel / 100) * (1 + variation);
        const barHeight = Math.max(
          4,
          Math.min(maxBarHeight, normalizedLevel * maxBarHeight)
        );

        const x = i * barWidth;
        const y = dimensions.height / 2 - barHeight / 2;

        const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);
        gradient.addColorStop(0, "#3b82f6");
        gradient.addColorStop(0.5, "#6366f1");
        gradient.addColorStop(1, "#8b5cf6");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioLevel, isActive, dimensions]);

  return (
    <div className="flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg"
      />
    </div>
  );
}
