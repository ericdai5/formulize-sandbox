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

const combinedPlotConfig: IGraph2D = {
  id: "loss-gradient-plot",
  title: "Loss & Gradient vs Weight",
  xAxisLabel: "w",
  xAxisVar: "w_t",
  xRange: [-0.5, 2.5],
  yAxisVar: "L", // Primary y-axis (used as default)
  yAxisLabel: "L",
  yRange: [-5, 10], // Extended to show both loss (0-25) and gradient (-15 to 15)
  xAxisPos: "center", // Center x-axis at y=0 so gradient line crosses it
  yAxisPos: "edge",
  xGrid: "show",
  yGrid: "show",
  width: 560,
  height: 400,
  lines: [
    {
      dataId: "loss",
      parameter: "w_t",
      color: "#ef4444", // Red for loss (parabola)
    },
    {
      dataId: "gradient",
      parameter: "w_t",
      color: "#f97316", // Orange for gradient (linear)
    },
  ],
  points: [
    {
      dataId: "testing",
      stepId: "weight-update",
      persistence: true,
      color: "#3b82f6", // Blue
    },
  ],
};

const gradientDescentConfig: Config = {
  formulas: [
    {
      id: "loss-function",
      latex: "L = (y - w_t \\cdot x)^2",
    },
    {
      id: "gradient",
      latex: "\\nabla L = -2x(y - w_t \\cdot x)",
    },
    {
      id: "update-rule",
      latex: "w_{t+1} = w_t - \\alpha \\cdot \\nabla L",
    },
  ],
  variables: {
    // Index variable t (iteration number)
    t: {
      input: "drag",
      name: "Iteration",
      default: 0,
      precision: 0,
    },
    // t+1 index for the next weight
    "t+1": {
      input: "drag",
      name: "Next Iteration",
      default: 1,
      precision: 0,
    },
    // Loss and Gradient (computed at current w_t)
    L: { name: "Loss", precision: 4 },
    "\\nabla L": { name: "Gradient", precision: 4 },
    // Current weight w_t (input, user can adjust starting point)
    w_t: {
      default: 0.5,
      range: [-1, 4],
      step: 0.05,
      name: "Current Weight",
      precision: 3,
    },
    // Next weight w_{t+1} (computed)
    "w_{t+1}": {
      name: "Next Weight",
      precision: 4,
    },
    // Learning rate
    "\\alpha": {
      input: "drag",
      default: 0.1,
      range: [0.01, 0.5],
      step: 0.01,
      name: "Learning Rate",
      precision: 3,
    },
    // Data inputs
    x: {
      input: "drag",
      default: 1.5,
      range: [0.5, 3],
      step: 0.1,
      name: "Input Feature x",
      precision: 2,
    },
    y: {
      input: "drag",
      default: 3,
      range: [1, 5],
      step: 0.1,
      name: "Target Value y",
      precision: 2,
    },
  },
  stepping: true,
  semantics: function ({ vars, data2d, step }) {
    var x = vars.x;
    var y = vars.y;
    var alpha = vars["\\alpha"];
    var w_t = vars.w_t;
    var numIterations = 6;
    for (var t = 0; t < numIterations; t++) {
      var t_plus_1 = t + 1;
      var prediction = w_t * x;
      var error = y - prediction;
      step({
        "loss-function": {
          description: "$Error = y - prediction = " + error.toFixed(2) + "$",
          labels: {
            y: y,
            w_t: w_t,
            x: x,
          },
        },
      });
      var L = error * error;
      step({
        "loss-function": {
          description: "$Error^2 = " + L.toFixed(2) + "$",
          labels: { L: L },
        },
      });
      data2d("loss", { x: w_t, y: L });
      var nablaL = -2 * x * error;
      data2d("gradient", { x: w_t, y: nablaL });
      step({
        "loss-function": {
          description: "$Error = y - prediction = " + error.toFixed(2) + "$",
          labels: {
            y: y,
            w_t: w_t,
            x: x,
          },
        },
        gradient: {
          description: "Calculating gradient",
          labels: {
            "\\nabla L": nablaL,
            "-2x(y - w_t \\cdot x)":
              "$-2 \\cdot " +
              x.toFixed(2) +
              " \\cdot " +
              error.toFixed(2) +
              " = " +
              nablaL.toFixed(2) +
              "$",
          },
        },
      });
      var stepSize = alpha * nablaL;
      step({
        "update-rule": {
          labels: {
            "\\alpha": alpha,
            "\\nabla L": nablaL,
            "\\alpha \\cdot \\nabla L":
              "Calculating step = $" + stepSize.toFixed(2) + "$",
          },
        },
      });
      var w_t_plus_1 = w_t - stepSize;
      data2d("testing", { x: w_t, y: L });
      step(
        {
          "update-rule": {
            labels: {
              "w_{t+1}": w_t_plus_1,
              w_t: w_t,
              t: t,
              "t+1": t_plus_1,
              "w_{t+1} = w_t - \\alpha \\cdot \\nabla L":
                "Calculated next weight $w_{t+1} = " +
                w_t_plus_1.toFixed(2) +
                "$",
            },
          },
        },
        "weight-update",
      );
      w_t = w_t_plus_1;
    }
    // Summary
    step({
      "update-rule": {
        description:
          "Final weight after " +
          numIterations +
          " iterations: $w_t = " +
          w_t.toFixed(2) +
          "$",
        labels: { w_t: w_t },
      },
    });
    return w_t;
  },
  // Add visualizations to the config
  graph2d: [combinedPlotConfig],
  fontSize: 1.3,
  labelFontSize: 1,
};

const GradientDescentContent: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gradient Descent Step-by-Step
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          <InlineVariable id="\alpha" display="both" /> is the learning rate,{" "}
          <InlineVariable id="x" display="both" /> is the input feature, and{" "}
          <InlineVariable id="y" display="both" /> is the target value.
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
            id="gradient"
            style={{
              height: "200px",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: "0.5rem",
            }}
          />
          <Formula
            id="update-rule"
            style={{
              height: "200px",
              width: "100%",
              border: "1px solid #eee",
              borderRadius: "0.5rem",
            }}
          />
        </div>
        <div className="space-y-4">
          <Graph
            id={combinedPlotConfig.id}
            style={{ width: "100%", height: "500px" }}
          />
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <div className="flex items-center justify-around">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500" />
                <span>Loss L (parabola)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-orange-500" />
                <span>Gradient ∇L (line)</span>
              </div>
            </div>
          </div>
          <StepControl className="w-full" />
        </div>
      </div>
    </div>
  );
};

export const GradientDescentExample: React.FC = () => {
  return (
    <Provider config={gradientDescentConfig}>
      <GradientDescentContent />
    </Provider>
  );
};

export default GradientDescentExample;
