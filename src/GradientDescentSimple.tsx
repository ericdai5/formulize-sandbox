import React from "react";

import {
  Formula,
  Provider,
  InlineVariable,
  StepControl,
  Graph,
  type Config,
  type IGraph2D,
} from "math-notation";

const graphConfig: IGraph2D = {
  id: "gradient-descent",
  xAxisLabel: "w_t",
  xAxisVar: "w_t",
  yAxisLabel: "L",
  yAxisVar: "L",
  yRange: [-5, 10],
  xRange: [0, 4],
  lines: [
    {
      sampleId: "initial-loss",
      parameter: "w_t",
      interaction: ["horizontal-drag", "y"],
    },
  ],
  points: [
    {
      sampleId: "initial-loss",
      stepId: "gd-step",
      persistence: true,
    },
  ],
  vectors: [
    {
      startSampleId: "initial-loss",
      endSampleId: "final-loss",
      stepId: "gd-step",
      persistence: true,
      curved: -1,
    },
  ],
};

const gradientDescentConfig: Config = {
  formulas: [
    { id: "loss-function", latex: "L = (y - w_t \\cdot x)^2" },
    {
      id: "update-weight",
      latex: "w_{t+1} = w_t - \\alpha \\cdot (-2x(y - w_t \\cdot x))",
    },
  ],
  variables: {
    L: { name: "Loss" },
    w_t: { default: 0.5, name: "Current Weight" },
    "w_{t+1}": { default: 0.5, name: "Next Weight" },
    "\\alpha": {
      default: 0.1,
      input: "drag",
      range: [0, 1],
      name: "Learning Rate",
    },
    x: { default: 1.5, input: "drag", range: [0, 4], name: "Feature" },
    y: { default: 3.0, input: "drag", range: [0, 4], name: "Label" },
  },
  stepping: true,
  semantics: function ({ vars, sample, step, latex }) {
    var w = vars.w_t;
    for (var t = 0; t < 6; t++) {
      var error = vars.y - w * vars.x;
      var loss = error * error;
      var gradient = -2 * vars.x * error;
      sample("initial-loss", { x: w, y: loss });
      step(
        {
          "loss-function": {
            labels: {
              L: "Loss is " + latex(loss).precision(2),
              "y - w_t \\cdot x": "Error is " + latex(error).precision(2),
            },
          },
          "update-weight": {
            labels: {
              w_t: w,
              "\\alpha": vars["\\alpha"],
              "w_{t+1}": w - vars["\\alpha"] * gradient,
              "(-2x(y - w_t \\cdot x)":
                "Gradient is " + latex(gradient).precision(2),
            },
          },
        },
        "gd-step",
      );
      w -= vars["\\alpha"] * gradient;
      vars.L = (vars.y - w * vars.x) * (vars.y - w * vars.x);
      sample("final-loss", { x: w, y: vars.L });
    }
    vars["w_{t+1}"] = w;
  },
  graph2d: [graphConfig],
  fontSize: 1.3,
  labelFontSize: 1,
};

const GradientDescentSimpleContent: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto min-h-screen p-4">
      <header className="mb-8 text-center">
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Visualizing gradient descent with vectors showing weight updates.
          <InlineVariable id="\alpha" display="both" /> is the learning rate,{" "}
          <InlineVariable id="x" display="both" /> is the feature, and{" "}
          <InlineVariable id="y" display="both" /> is the label.
        </p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Formula
            id="loss-function"
            style={{
              height: "200px",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: "0.5rem",
            }}
          />
          <Formula
            id="update-weight"
            style={{
              height: "200px",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: "0.5rem",
            }}
          />
          <StepControl className="w-full" />
        </div>
        <div className="space-y-4">
          <Graph
            id={graphConfig.id}
            style={{ width: "100%", height: "500px" }}
          />
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <div className="flex items-center justify-around">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-blue-500" />
                <span>Loss curve</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Weight position</span>
              </div>
              <div className="flex items-center gap-2">
                <span>→</span>
                <span>Update vector</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GradientDescentSimpleExample: React.FC = () => {
  return (
    <Provider config={gradientDescentConfig}>
      <GradientDescentSimpleContent />
    </Provider>
  );
};

export default GradientDescentSimpleExample;
