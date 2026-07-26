// Registry of all sandbox examples. Keep menu metadata separate from the raw
// source map used to seed the playground editor.

import neuralRaw from "./NeuralNetwork.tsx?raw";
import bayesRaw from "./BayesVisualization.tsx?raw";
import mannWhitneyRaw from "./MannWhitney.tsx?raw";
import gradientDescentFullRaw from "./GradientDescent.tsx?raw";
import gradientDescentSimpleRaw from "./gradient-descent.tsx?raw";
import newtonCoolingRaw from "./NewtonCooling.tsx?raw";
import matrixMultiplicationRaw from "./matrix-multiplication.tsx?raw";
import kineticEnergyRaw from "./kinetic-energy.tsx?raw";
import gravitationalForceRaw from "./gravitational-force.tsx?raw";
import vectorAdditionRaw from "./vector-addition.tsx?raw";
import halfLifeRaw from "./half-life.tsx?raw";
import waveFormulaRaw from "./wave-formula.tsx?raw";
import averageRaw from "./average.tsx?raw";
import probabilityRaw from "./probability.tsx?raw";

export type ExampleEntry = {
  id: string;
  label: string;
  description?: string;
};

export const EXAMPLES: ExampleEntry[] = [
  {
    id: "kinetic-energy",
    label: "Kinetic Energy",
    description: "K = ½mv² with a draggable graph.",
  },
  {
    id: "gravitational-force",
    label: "Gravitational Force",
    description: "Newton's law of universal gravitation, stepped.",
  },
  {
    id: "vector-addition",
    label: "Vector Addition",
    description: "Linear combination of two 2D vectors.",
  },
  {
    id: "half-life",
    label: "Half-Life (SVG)",
    description: "Radioactive decay with dynamic SVG variables.",
  },
  {
    id: "wave-formula",
    label: "Wave Equation (SVG)",
    description: "Wave equation rendered with SVG variables.",
  },
  {
    id: "average",
    label: "Average",
    description: "Step-by-step computation of a mean.",
  },
  {
    id: "probability",
    label: "Probability",
    description: "Joint probability of two events with draggables.",
  },
  {
    id: "matrix-multiplication",
    label: "Matrix Multiplication",
    description: "Custom matrix layout with annotations.",
  },
  {
    id: "gradient-descent-simple",
    label: "Gradient Descent (Simple)",
    description: "Minimal gradient-descent visualization.",
  },
  {
    id: "gradient-descent",
    label: "Gradient Descent",
    description: "Full gradient-descent walkthrough.",
  },
  {
    id: "neural",
    label: "Neural Network",
    description: "Forward/back pass over a small network.",
  },
  {
    id: "bayes",
    label: "Bayes Theorem",
    description: "Interactive Bayes' theorem visualization.",
  },
  {
    id: "mannwhitney",
    label: "Mann-Whitney U Test",
    description: "Non-parametric test, ranked.",
  },
  {
    id: "newton-cooling",
    label: "Newton's Law of Cooling",
    description: "Exponential cooling toward ambient.",
  },
];

const EXAMPLE_SOURCES: Record<string, string> = {
  "kinetic-energy": kineticEnergyRaw,
  "gravitational-force": gravitationalForceRaw,
  "vector-addition": vectorAdditionRaw,
  "half-life": halfLifeRaw,
  "wave-formula": waveFormulaRaw,
  average: averageRaw,
  probability: probabilityRaw,
  "matrix-multiplication": matrixMultiplicationRaw,
  "gradient-descent-simple": gradientDescentSimpleRaw,
  "gradient-descent": gradientDescentFullRaw,
  neural: neuralRaw,
  bayes: bayesRaw,
  mannwhitney: mannWhitneyRaw,
  "newton-cooling": newtonCoolingRaw,
};

export function getExample(id: string): ExampleEntry | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

export function getExampleSource(id: string): string | undefined {
  return EXAMPLE_SOURCES[id];
}
