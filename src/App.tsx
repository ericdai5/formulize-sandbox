import { useState } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import "./App.css";
import NeuralNetwork from "./NeuralNetwork";
import Kinetic2D from "./Kinetic2D";
import BayesVisualization from "./BayesVisualization";
import Summation from "./MinimalSummation";
import MannWhitney from "./MannWhitney";
import GradientDescentFull from "./GradientDescent";
import GradientDescent from "./gradient-descent";
import NewtonCooling from "./NewtonCooling";
import MatrixMultiplication from "./matrix-multiplication";
import KineticEnergy from "./kinetic-energy";
import GravitationalForce from "./gravitational-force";
import VectorAddition from "./vector-addition";
import HalfLife from "./half-life";
import WaveFormula from "./wave-formula";
import Average from "./average";
import Probability from "./probability";

const examples = [
  { id: "neural", path: "/neural", label: "Neural Network" },
  { id: "mannwhitney", path: "/mannwhitney", label: "Mann-Whitney U Test" },
  { id: "newton-cooling", path: "/newton-cooling", label: "Newton's Law of Cooling" },
  { id: "gradient-descent", path: "/gradient-descent", label: "Gradient Descent" },
  { id: "gradient-descent-simple", path: "/gradient-descent-simple", label: "Gradient Descent (Simple)" },
  { id: "kinetic", path: "/kinetic", label: "Kinetic Energy" },
  { id: "bayes", path: "/bayes", label: "Bayes Theorem" },
  { id: "summation", path: "/summation", label: "Summation" },
  { id: "matrix", path: "/matrix", label: "Matrix Multiplication" },
  { id: "gallery-kinetic", path: "/gallery-kinetic", label: "Gallery: Kinetic Energy" },
  { id: "gallery-gravity", path: "/gallery-gravity", label: "Gallery: Gravitational Force" },
  { id: "vector-addition", path: "/vector-addition", label: "Vector Addition" },
  { id: "half-life", path: "/half-life", label: "Half-Life (SVG)" },
  { id: "wave-formula", path: "/wave-formula", label: "Wave Equation (SVG)" },
  { id: "average", path: "/average", label: "Average" },
  { id: "probability", path: "/probability", label: "Probability" },
];

function App() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();
  const currentExample = examples.find((ex) => ex.path === location.pathname);

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-10 h-10 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
          title={currentExample?.label}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden min-w-[200px]">
            {examples.map((example) => (
              <Link
                key={example.id}
                to={example.path}
                onClick={() => setDropdownOpen(false)}
                className={`block w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors whitespace-nowrap ${
                  location.pathname === example.path
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700"
                }`}
              >
                {example.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/neural" replace />} />
          <Route path="/neural" element={<NeuralNetwork />} />
          <Route path="/mannwhitney" element={<MannWhitney />} />
          <Route path="/newton-cooling" element={<NewtonCooling />} />
          <Route path="/gradient-descent" element={<GradientDescentFull />} />
          <Route path="/gradient-descent-simple" element={<GradientDescent />} />
          <Route path="/kinetic" element={<Kinetic2D />} />
          <Route path="/bayes" element={<BayesVisualization />} />
          <Route path="/summation" element={<Summation />} />
          <Route path="/matrix" element={<MatrixMultiplication />} />
          <Route path="/gallery-kinetic" element={<KineticEnergy />} />
          <Route path="/gallery-gravity" element={<GravitationalForce />} />
          <Route path="/vector-addition" element={<VectorAddition />} />
          <Route path="/half-life" element={<HalfLife />} />
          <Route path="/wave-formula" element={<WaveFormula />} />
          <Route path="/average" element={<Average />} />
          <Route path="/probability" element={<Probability />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
