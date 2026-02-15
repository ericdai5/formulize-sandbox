import React from "react";
import {
  Formula,
  Provider,
  StepControl,
  type Config,
} from "math-notation";

// First config: Expected Value with 10 items
const config1: Config = {
  formulas: [
    {
      id: "summation-basic",
      latex: "E = \\sum_{x \\in X} x P(x)",
    },
  ],
  variables: {
    E: {
      precision: 2,
      default: 0,
      name: "Expected Value",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    x: {
      input: "drag",
      precision: 0,
      name: "x: member of X",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    X: {
      input: "drag",
      default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      precision: 0,
    },
    "P(x)": {
      input: "drag",
      key: "x",
      default: [0.05, 0.08, 0.12, 0.15, 0.2, 0.18, 0.12, 0.06, 0.03, 0.01],
      precision: 2,
      name: "Probability of x",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    c: {
      precision: 2,
      name: "Current Expected Value",
      latexDisplay: "name",
      labelDisplay: "value",
    },
  },
  stepping: true,
  semantics: function ({ vars, step }) {
    var xValues = vars.X;
    var pxValues = vars["P(x)"];
    var expectedValue = vars.E;
    for (var i = 0; i < xValues.length; i++) {
      var xi = xValues[i];
      var probability = pxValues[i];
      if (i === 0) {
        step({ description: "Get a value x from X:", values: [["x", xi]] });
        step({
          description: "Get a value P(x) from P(x):",
          values: [["P(x)", probability]],
        });
      }
      var currExpected = Math.round(xi * probability * 100) / 100;
      if (i === 0) {
        step({
          description: "This evaluates to:",
          values: [["c", currExpected]],
        });
      }
      expectedValue = Math.round((expectedValue + currExpected) * 100) / 100;
      switch (i) {
        case 0:
          step({
            description: "add up term into E:",
            values: [["E", expectedValue]],
          });
          break;
        case 1:
          step({
            description: "add next term...",
            values: [["E", expectedValue]],
          });
          break;
        case xValues.length - 1:
          step({
            description: "finish accumulating weighted sum:",
            values: [["E", expectedValue]],
          });
          break;
      }
    }
    vars.E = expectedValue;
  },
  fontSize: 1.5,
};

// Second config: Simple summation with 5 items (different formula)
const config2: Config = {
  formulas: [
    {
      id: "sum-basic",
      latex: "S = \\sum_{i=1}^{n} a_i",
    },
  ],
  variables: {
    S: {
      precision: 2,
      default: 0,
      name: "Sum",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    i: {
      precision: 0,
      name: "index i",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    n: {
      default: 5,
      precision: 0,
    },
    a_i: {
      default: [2, 4, 6, 8, 10],
      precision: 0,
      name: "a_i",
      latexDisplay: "name",
      labelDisplay: "value",
    },
  },
  stepping: true,
  semantics: function ({ vars, step }) {
    var sum = vars.S;
    var values = vars.a_i;
    for (var i = 0; i < values.length; i++) {
      var a = values[i];
      step({ description: "Current element:", values: [["a_i", a]] });
      sum = sum + a;
      step({ description: "Running sum:", values: [["S", sum]] });
    }
    vars.S = sum;
  },
  fontSize: 1.5,
};

const MinimalSummation: React.FC = () => {
  return (
    <div className="p-4 flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-slate-800">
        Multiple Independent Formulize Interpreters
      </h1>
      {/* First Formulize Provider - Expected Value */}
      <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
        <h2 className="text-lg font-semibold text-blue-800 mb-4">
          Formula 1: Expected Value
        </h2>
        <Provider config={config1}>
          <div className="flex flex-col gap-4">
            <Formula
              id="summation-basic"
              style={{ height: "300px", width: "700px" }}
            />
            <StepControl />
          </div>
        </Provider>
      </div>
      {/* Second Formulize Provider - Simple Sum */}
      <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
        <h2 className="text-lg font-semibold text-green-800 mb-4">
          Formula 2: Simple Summation
        </h2>
        <Provider config={config2}>
          <div className="flex flex-col gap-4">
            <Formula
              id="sum-basic"
              style={{ height: "300px", width: "700px" }}
            />
            <StepControl />
          </div>
        </Provider>
      </div>
    </div>
  );
};

export default MinimalSummation;
