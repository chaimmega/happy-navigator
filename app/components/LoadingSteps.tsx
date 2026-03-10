"use client";

import { motion } from "framer-motion";

const steps = [
  { emoji: "📍", text: "Geocoding your locations..." },
  { emoji: "🚗", text: "Fetching driving route alternatives..." },
  { emoji: "🌿", text: "Scanning scenic roads, parks & points of interest..." },
  { emoji: "✨", text: "AI finding happiest route..." },
];

interface LoadingStepsProps {
  currentStep: number;
}

export function LoadingSteps({ currentStep }: LoadingStepsProps) {
  return (
    <div className="space-y-3 py-4">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ x: -10, opacity: 0 }}
          animate={{
            x: 0,
            opacity: i <= currentStep ? 1 : 0.3,
          }}
          transition={{ duration: 0.3, delay: i * 0.1 }}
          className="flex items-center gap-3"
        >
          <span className="text-lg">{step.emoji}</span>
          <span className={`text-sm ${i <= currentStep ? "text-foreground font-medium" : "text-muted-foreground"}`}>
            {step.text}
          </span>
          {i < currentStep && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto text-primary text-sm"
            >
              ✓
            </motion.span>
          )}
          {i === currentStep && (
            <span className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </motion.div>
      ))}
    </div>
  );
}
