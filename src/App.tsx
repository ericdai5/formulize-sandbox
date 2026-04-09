import { useState } from "react";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import "./App.css";
import NeuralNetworkExample from "./NeuralNetwork";
import Kinetic2DExample from "./Kinetic2D";
import BayesVisualizationExample from "./BayesVisualization";
import MinimalSummation from "./MinimalSummation";
import MannWhitneyExample from "./MannWhitney";
import GradientDescentExample from "./GradientDescent";
import GradientDescentSimpleExample from "./GradientDescentSimple";
import NewtonCoolingExample from "./NewtonCooling";

const examples = [
  { id: "neural", path: "/neural", label: "Neural Network" },
  { id: "mannwhitney", path: "/mannwhitney", label: "Mann-Whitney U Test" },
  { id: "newton-cooling", path: "/newton-cooling", label: "Newton's Law of Cooling" },
  { id: "gradient-descent", path: "/gradient-descent", label: "Gradient Descent" },
  { id: "gradient-descent-simple", path: "/gradient-descent-simple", label: "Gradient Descent (Simple)" },
  { id: "kinetic", path: "/kinetic", label: "Kinetic Energy" },
  { id: "bayes", path: "/bayes", label: "Bayes Theorem" },
  { id: "summation", path: "/summation", label: "Summation" },
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
          <Route path="/neural" element={<NeuralNetworkExample />} />
          <Route path="/mannwhitney" element={<MannWhitneyExample />} />
          <Route path="/newton-cooling" element={<NewtonCoolingExample />} />
          <Route path="/gradient-descent" element={<GradientDescentExample />} />
          <Route path="/gradient-descent-simple" element={<GradientDescentSimpleExample />} />
          <Route path="/kinetic" element={<Kinetic2DExample />} />
          <Route path="/bayes" element={<BayesVisualizationExample />} />
          <Route path="/summation" element={<MinimalSummation />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
