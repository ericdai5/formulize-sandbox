import React from "react";

import {
  Formula,
  FormulizeProvider,
  VisualizationComponent,
  InlineFormula,
  InlineVariable,
  type FormulizeConfig,
} from "formulize-math";

const kineticConfig: FormulizeConfig = {
  formulas: [
    {
      id: "kinetic-energy",
      latex: "K = \\frac{1}{2}mv^2",
    },
  ],
  variables: {
    K: {
      role: "computed",
      units: "J",
      name: "Kinetic Energy",
      precision: 2,
    },
    m: {
      role: "input",
      default: 1,
      range: [0.1, 10],
      step: 1,
      units: "kg",
      name: "Mass",
    },
    v: {
      role: "input",
      default: 2,
      range: [0.1, 100],
      step: 1,
      units: "m/s",
      name: "Velocity",
    },
  },
  semantics: {
    engine: "manual",
    expressions: {
      "kinetic-energy": "{K} = 0.5 * {m} * {v} * {v}",
    },
    manual: function (vars) {
      const m = vars.m;
      const v = vars.v;
      return 0.5 * m * Math.pow(v, 2);
    },
  },
  visualizations: [
    {
      type: "plot2d" as const,
      xAxis: "v",
      yAxis: "K",
    },
  ],
  fontSize: 1.5,
};

// SVG Integration: Radioactive Decay Example
const radioactiveDecayConfig: FormulizeConfig = {
  formulas: [
    {
      id: "radioactive-decay",
      latex: "{N} = {N_{0}} \\times e^{-{\\lambda} \\times {t}}",
    },
  ],
  variables: {
    N: {
      role: "computed",
      name: "Substance Remaining",
      units: "atoms",
      precision: 0,
      latexDisplay: "value",
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <!-- Green radioactive hazard symbol -->
        <g>
          <!-- Background circle -->
          <circle cx="12" cy="12" r="10" fill="#00E676" opacity="0.2">
            <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite"/>
          </circle>

          <!-- Three evenly spaced radioactive petals (120 degrees apart) -->
          <g>
            <animateTransform attributeName="transform" type="rotate"
                             from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite"/>
            <!-- Top petal (0 degrees) -->
            <path d="M 12 12 L 10 5 A 4.5 4.5 0 0 1 14 5 Z" fill="#00E676"/>
            <!-- Bottom right petal (120 degrees from top) -->
            <path d="M 12 12 L 10 5 A 4.5 4.5 0 0 1 14 5 Z" fill="#00E676" transform="rotate(120 12 12)"/>
            <!-- Bottom left petal (240 degrees from top) -->
            <path d="M 12 12 L 10 5 A 4.5 4.5 0 0 1 14 5 Z" fill="#00E676" transform="rotate(240 12 12)"/>
          </g>

          <!-- Center circle -->
          <circle cx="12" cy="12" r="2.5" fill="#00C853">
            <animate attributeName="r" values="2.5;3;2.5" dur="1.5s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>`,
      svgMode: "replace",
      defaultCSS:
        "filter: drop-shadow(0 0 8px #7FFF00) saturate(calc({value} / 1000));",
      hoverCSS: "filter: drop-shadow(0 0 12px #00FF00); transform: scale(1.1);",
    },
    N_0: {
      role: "input",
      default: 1000,
      name: "Substance Initial",
      range: [100, 10000],
      step: 100,
      precision: 0,
      units: "atoms",
      latexDisplay: "name",
      defaultCSS: "filter: drop-shadow(0 0 8px #7FFF00) saturate(1);",
      hoverCSS: "filter: drop-shadow(0 0 12px #00FF00); transform: scale(1.1);",
    },
    "\\lambda": {
      role: "input",
      default: 0.1,
      name: "Decay Constant",
      range: [0.01, 0.5],
      step: 0.01,
      precision: 3,
      units: "1/hr",
      latexDisplay: "name",
    },
    t: {
      role: "input",
      default: 5,
      name: "time",
      range: [0, 50],
      step: 0.5,
      precision: 1,
      units: "hr",
      latexDisplay: "value",
      svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <!-- Outer clock circle -->
        <circle cx="12" cy="12" r="10" fill="#E0E7FF" stroke="#4169E1" stroke-width="2"/>
        <!-- Clock hands -->
        <g>
          <!-- Hour hand (shorter, slower) -->
          <line x1="12" y1="12" x2="12" y2="8" stroke="#2563EB" stroke-width="2" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate"
                             from="0 12 12" to="360 12 12" dur="120s" repeatCount="indefinite"/>
          </line>
          <!-- Minute hand (longer, faster) -->
          <line x1="12" y1="12" x2="12" y2="5" stroke="#4169E1" stroke-width="1.5" stroke-linecap="round">
            <animateTransform attributeName="transform" type="rotate"
                             from="0 12 12" to="360 12 12" dur="10s" repeatCount="indefinite"/>
          </line>
        </g>
        <!-- Center dot -->
        <circle cx="12" cy="12" r="1" fill="#1E40AF"/>
      </svg>`,
      svgMode: "replace",
    },
  },
  semantics: {
    engine: "manual",
    expressions: {
      "radioactive-decay": "{N} = {N_0} * exp(-{\\lambda} * {t})",
    },
    manual: function (vars) {
      const N_0 = vars.N_0;
      const lambda = vars["\\lambda"];
      const t = vars.t;
      return N_0 * Math.exp(-lambda * t);
    },
  },
  visualizations: [
    {
      type: "plot2d" as const,
      xAxis: "t",
      xRange: [0, 50],
      xGrid: "show",
      yAxis: "N",
      yRange: [0, 1100],
      yGrid: "show",
      lines: [
        {
          color: "#7FFF00",
        },
      ],
    },
  ],
  fontSize: 1.5,
};

export const Kinetic2DExample: React.FC = () => {
  return (
    <div className="space-y-12">
      {/* Kinetic Energy Section */}
      <FormulizeProvider config={kineticConfig}>
        <div className="rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Kinetic Energy
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The kinetic energy formula{" "}
            <InlineFormula id="kinetic-energy" scale={1.0} /> shows that energy
            depends on both mass and velocity. With mass{" "}
            <InlineVariable id="m" display="withUnits" /> and velocity{" "}
            <InlineVariable id="v" display="withUnits" />, the kinetic energy is{" "}
            <InlineVariable id="K" display="withUnits" />. Doubling velocity
            quadruples the energy, while doubling mass only doubles it.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Formula
              id="kinetic-energy"
              style={{ height: "200px", width: "300px" }}
            />
            {kineticConfig.visualizations &&
              kineticConfig.visualizations[0] && (
                <VisualizationComponent
                  type="plot2d"
                  config={kineticConfig.visualizations[0]}
                  height={400}
                />
              )}
          </div>
        </div>
      </FormulizeProvider>

      {/* Radioactive Decay Section with SVG Integration */}
      <FormulizeProvider config={radioactiveDecayConfig}>
        <div className="rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Radioactive Decay (SVG Integration)
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            This example demonstrates <strong>SVG integration</strong> with
            animated icons replacing variable symbols. The formula{" "}
            <InlineFormula id="radioactive-decay" scale={1.0} /> models
            exponential decay where <InlineVariable id="N" display="both" />{" "}
            atoms remain after time{" "}
            <InlineVariable id="t" display="withUnits" />, starting from{" "}
            <InlineVariable id="N_0" display="withUnits" /> with decay constant{" "}
            <InlineVariable id="\\lambda" display="withUnits" />.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Formula id="radioactive-decay" style={{ height: "250px" }} />
            {radioactiveDecayConfig.visualizations &&
              radioactiveDecayConfig.visualizations[0] && (
                <VisualizationComponent
                  type="plot2d"
                  config={radioactiveDecayConfig.visualizations[0]}
                  height={400}
                />
              )}
          </div>
        </div>
      </FormulizeProvider>
    </div>
  );
};

export default Kinetic2DExample;
