import React from "react";

import {
  Formula,
  FormulizeProvider,
  InlineVariable,
  InterpreterControl,
  VisualizationComponent,
  type FormulizeConfig,
  type IPlot2D,
  step,
} from "formulize-math";

const combinedPlotConfig: IPlot2D = {
  type: "plot2d",
  id: "loss-gradient-plot",
  title: "Loss & Gradient vs Weight",
  xAxis: "w_t",
  xRange: [-0.5, 2.5],
  yAxis: "L", // Primary y-axis (used as default)
  yRange: [-5, 10], // Extended to show both loss (0-25) and gradient (-15 to 15)
  xAxisPos: "center", // Center x-axis at y=0 so gradient line crosses it
  yAxisPos: "edge",
  xGrid: "show",
  yGrid: "show",
  width: 560,
  height: 400,
  lines: [
    {
      color: "#ef4444", // Red for loss (parabola)
      lineWidth: 2.5,
      name: "loss-function",
      yAxis: "L",
    },
    {
      color: "#f97316", // Orange for gradient (linear)
      lineWidth: 2.5,
      name: "gradient",
      yAxis: "\\nabla L",
    },
  ],
  // Add step points when specific views are active
  stepPoints: {
    "weight-update": {
      xValue: "w_t",
      yValue: "L",
      persistence: true,
      color: "#3b82f6", // Blue
      size: 6,
      label: "wₜ",
    },
  },
};

const gradientDescentConfig: FormulizeConfig = {
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
      role: "input",
      name: "Iteration",
      default: 0,
      precision: 0,
    },
    // t+1 index for the next weight
    "t+1": {
      role: "input",
      name: "Next Iteration",
      default: 1,
      precision: 0,
    },
    // Loss and Gradient (computed at current w_t)
    L: { role: "computed", name: "Loss", precision: 4 },
    "\\nabla L": { role: "computed", name: "Gradient", precision: 4 },
    // Current weight w_t (input, user can adjust starting point)
    w_t: {
      role: "input",
      default: 0.5,
      range: [-1, 4],
      step: 0.05,
      name: "Current Weight",
      precision: 3,
    },
    // Next weight w_{t+1} (computed)
    "w_{t+1}": {
      role: "computed",
      name: "Next Weight",
      precision: 4,
    },
    // Learning rate
    "\\alpha": {
      role: "input",
      default: 0.1,
      range: [0.01, 0.5],
      step: 0.01,
      name: "Learning Rate",
      precision: 3,
    },
    // Data inputs
    x: {
      role: "input",
      default: 1.5,
      range: [0.5, 3],
      step: 0.1,
      name: "Input Feature x",
      precision: 2,
    },
    y: {
      role: "input",
      default: 3,
      range: [1, 5],
      step: 0.1,
      name: "Target Value y",
      precision: 2,
    },
  },
  semantics: {
    engine: "manual",
    mode: "step",
    // Expressions are used by Plot2D to evaluate curves
    expressions: {
      "loss-function": "{L} = ({y} - {w_t} * {x})^2",
      gradient: "{\\nabla L} = -2 * {x} * ({y} - {w_t} * {x})",
      "update-rule": "{w_{t+1}} = {w_t} - {\\alpha} * {\\nabla L}",
    },
    manual: function (vars) {
      var x = vars.x;
      var y = vars.y;
      var alpha = vars["\\alpha"];
      var w_t = vars.w_t;
      var numIterations = 6;
      for (var t = 0; t < numIterations; t++) {
        var t_plus_1 = t + 1;
        var prediction = w_t * x;
        var error = y - prediction;
        step(
          "$Error = y - prediction = " + error + "$",
          [
            ["y", y],
            ["w_t", w_t],
            ["x", x],
          ],
          { formulaId: "loss-function" },
        );
        var L = error * error;
        step("$Error^2 = " + L + "$", [["L", L]], {
          formulaId: "loss-function",
        });
        var nablaL = -2 * x * error;
        step("$-2x \\cdot Error = " + nablaL + "$", [["\\nabla L", nablaL]], {
          expression: "-2x(y - w_t \\cdot x)",
          formulaId: "gradient",
        });
        var stepSize = alpha * nablaL;
        step(
          "Calculating step: $\\alpha \\cdot \\nabla L = " + stepSize + "$",
          [
            ["\\alpha", alpha],
            ["\\nabla L", nablaL],
          ],
          { expression: "\\alpha \\cdot \\nabla L", formulaId: "update-rule" },
        );
        var w_t_plus_1 = w_t - stepSize;
        step(
          "Calculated next weight $w_{t+1} = " + w_t_plus_1 + "$",
          [
            ["w_{t+1}", w_t_plus_1],
            ["w_t", w_t],
            ["t", t],
            ["t+1", t_plus_1],
          ],
          {
            id: "weight-update",
            expression: "w_{t+1} = w_t - \\alpha \\cdot \\nabla L",
            formulaId: "update-rule",
          },
        );
        w_t = w_t_plus_1;
      }
      // Summary
      step(
        "Final weight after " +
          numIterations +
          " iterations: $w_t = " +
          w_t +
          "$",
        [["w_t", w_t]],
        { formulaId: "update-rule" },
      );
      return w_t;
    },
  },
  // Add visualizations to the config
  visualizations: [combinedPlotConfig],
  fontSize: 1.3,
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
          <Formula id="loss-function" style={{ height: "200px", flex: 1 }} />
          <Formula id="gradient" style={{ height: "200px", flex: 1 }} />
          <Formula id="update-rule" style={{ height: "200px", flex: 1 }} />
        </div>
        <div className="space-y-4">
          <VisualizationComponent
            type="plot2d"
            config={combinedPlotConfig}
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
          <InterpreterControl width="100%" defaultCollapsed={true} />
        </div>
      </div>
    </div>
  );
};

export const GradientDescentExample: React.FC = () => {
  return (
    <FormulizeProvider config={gradientDescentConfig}>
      <GradientDescentContent />
    </FormulizeProvider>
  );
};

export default GradientDescentExample;
