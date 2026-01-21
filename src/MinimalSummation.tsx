import React from "react";
import {
  FormulaComponent,
  FormulizeProvider,
  InterpreterControl,
  view,
  type FormulizeConfig,
} from "formulize-math";

// First config: Expected Value with 10 items
const config1: FormulizeConfig = {
  formulas: [
    {
      id: "summation-basic",
      latex: "E = \\sum_{x \\in X} x P(x)",
    },
  ],
  variables: {
    E: {
      role: "computed",
      precision: 2,
      default: 0,
      name: "Expected Value",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    x: {
      role: "input",
      memberOf: "X",
      precision: 0,
      name: "x: member of X",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    X: {
      role: "input",
      default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      precision: 0,
    },
    "P(x)": {
      role: "input",
      key: "x",
      default: [0.05, 0.08, 0.12, 0.15, 0.2, 0.18, 0.12, 0.06, 0.03, 0.01],
      precision: 2,
      name: "Probability of x",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    c: {
      role: "computed",
      precision: 2,
      name: "Current Expected Value",
      latexDisplay: "name",
      labelDisplay: "value",
    },
  },
  semantics: {
    engine: "manual",
    mode: "step",
    manual: function (vars) {
      var xValues = vars.X;
      var pxValues = vars["P(x)"];
      var expectedValue = vars.E;
      for (var i = 0; i < xValues.length; i++) {
        var xi = xValues[i];
        var probability = pxValues[i];
        if (i === 0) {
          view("Get a value x from X:", { value: xi });
          view("Get a value P(x) from P(x):", { value: probability });
        }
        var currExpected = Math.round(xi * probability * 100) / 100;
        if (i === 0) {
          view("This evaluates to:", { value: currExpected });
        }
        expectedValue = Math.round((expectedValue + currExpected) * 100) / 100;
        switch (i) {
          case 0:
            view("add up term into E:", { value: expectedValue });
            break;
          case 1:
            view("add next term...", { value: expectedValue });
            break;
          case xValues.length - 1:
            view("finish accumulating weighted sum:", { value: expectedValue });
            break;
        }
      }
      return expectedValue;
    },
  },
  fontSize: 1.5,
};

// Second config: Simple summation with 5 items (different formula)
const config2: FormulizeConfig = {
  formulas: [
    {
      id: "sum-basic",
      latex: "S = \\sum_{i=1}^{n} a_i",
    },
  ],
  variables: {
    S: {
      role: "computed",
      precision: 2,
      default: 0,
      name: "Sum",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    i: {
      role: "index",
      precision: 0,
      name: "index i",
      latexDisplay: "name",
      labelDisplay: "value",
    },
    n: {
      role: "input",
      default: 5,
      precision: 0,
    },
    a_i: {
      role: "input",
      index: "i",
      default: [2, 4, 6, 8, 10],
      precision: 0,
      name: "a_i",
      latexDisplay: "name",
      labelDisplay: "value",
    },
  },
  semantics: {
    engine: "manual",
    mode: "step",
    manual: function (vars) {
      var sum = vars.S;
      var values = vars.a_i;
      for (var i = 0; i < values.length; i++) {
        var a = values[i];
        view("Current element:", { value: a });
        sum = sum + a;
        view("Running sum:", { value: sum });
      }
      return sum;
    },
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
        <FormulizeProvider config={config1}>
          <div className="flex flex-col gap-4">
            <FormulaComponent
              id="summation-basic"
              style={{ height: "300px", width: "700px" }}
            />
            <InterpreterControl environment={config1} width={700} />
          </div>
        </FormulizeProvider>
      </div>

      {/* Second Formulize Provider - Simple Sum */}
      <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
        <h2 className="text-lg font-semibold text-green-800 mb-4">
          Formula 2: Simple Summation
        </h2>
        <FormulizeProvider config={config2}>
          <div className="flex flex-col gap-4">
            <FormulaComponent
              id="sum-basic"
              style={{ height: "300px", width: "700px" }}
            />
            <InterpreterControl environment={config2} width={700} />
          </div>
        </FormulizeProvider>
      </div>
    </div>
  );
};

export default MinimalSummation;
