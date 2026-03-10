"use client";

import { motion } from "framer-motion";

interface AISummaryCardProps {
  bullets: string[];
  suggestedStops?: string[];
  startName: string;
  endName: string;
}

export function AISummaryCard({ bullets, suggestedStops, startName, endName }: AISummaryCardProps) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-border bg-card p-4"
      style={{ borderImage: "linear-gradient(135deg, hsl(280,70%,75%), hsl(210,90%,70%), hsl(155,75%,60%)) 1" }}
    >
      <div className="rounded-2xl border-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">😊</span>
          <h3 className="font-bold text-sm text-foreground">Happy Route Found!</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          {startName} → {endName}
        </p>
        <ul className="space-y-1.5 mb-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs text-foreground leading-relaxed">
              <span className="shrink-0 text-primary">✦</span>
              {b}
            </li>
          ))}
        </ul>
        {suggestedStops && suggestedStops.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Suggested Stops
            </p>
            <div className="space-y-2.5">
              {suggestedStops.map((stop, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * i }}
                  className="flex gap-3 items-start rounded-xl bg-muted p-2 group hover:bg-accent transition-colors"
                >
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="text-xs font-medium text-foreground leading-snug">{stop}</p>
                  </div>
                  <span className="shrink-0 text-sm mt-0.5">📍</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
