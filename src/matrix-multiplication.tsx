import React from "react";
import { Formula, Provider, Custom, type Config } from "math-notation";

const inputVar = (defaultVal: number) => ({
  input: "drag" as const,
  default: defaultVal,
  range: [-5, 5] as [number, number],
  step: 1,
  precision: 0,
  latexDisplay: "value" as const,
  labelDisplay: "none" as const,
});

const outputVar = {
  precision: 0,
  latexDisplay: "value" as const,
  labelDisplay: "none" as const,
};

const matrixConfig: Config = {
  formulas: [
    {
      id: "matrix-multiplication",
      latex:
        "\\begin{bmatrix} {a_{11}} & {a_{12}} & {a_{13}} \\\\ {a_{21}} & {a_{22}} & {a_{23}} \\\\ {a_{31}} & {a_{32}} & {a_{33}} \\end{bmatrix} \\begin{bmatrix} {b_{11}} & {b_{12}} & {b_{13}} \\\\ {b_{21}} & {b_{22}} & {b_{23}} \\\\ {b_{31}} & {b_{32}} & {b_{33}} \\end{bmatrix} = \\begin{bmatrix} {c_{11}} & {c_{12}} & {c_{13}} \\\\ {c_{21}} & {c_{22}} & {c_{23}} \\\\ {c_{31}} & {c_{32}} & {c_{33}} \\end{bmatrix}",
    },
  ],
  variables: {
    "a_{11}": inputVar(1),
    "a_{12}": inputVar(2),
    "a_{13}": inputVar(0),
    "a_{21}": inputVar(0),
    "a_{22}": inputVar(1),
    "a_{23}": inputVar(1),
    "a_{31}": inputVar(3),
    "a_{32}": inputVar(0),
    "a_{33}": inputVar(2),
    "b_{11}": inputVar(2),
    "b_{12}": inputVar(1),
    "b_{13}": inputVar(0),
    "b_{21}": inputVar(0),
    "b_{22}": inputVar(1),
    "b_{23}": inputVar(2),
    "b_{31}": inputVar(1),
    "b_{32}": inputVar(0),
    "b_{33}": inputVar(1),
    "c_{11}": outputVar,
    "c_{12}": outputVar,
    "c_{13}": outputVar,
    "c_{21}": outputVar,
    "c_{22}": outputVar,
    "c_{23}": outputVar,
    "c_{31}": outputVar,
    "c_{32}": outputVar,
    "c_{33}": outputVar,
  },
  semantics: ({ vars }) => {
    vars["c_{11}"] =
      vars["a_{11}"] * vars["b_{11}"] +
      vars["a_{12}"] * vars["b_{21}"] +
      vars["a_{13}"] * vars["b_{31}"];
    vars["c_{12}"] =
      vars["a_{11}"] * vars["b_{12}"] +
      vars["a_{12}"] * vars["b_{22}"] +
      vars["a_{13}"] * vars["b_{32}"];
    vars["c_{13}"] =
      vars["a_{11}"] * vars["b_{13}"] +
      vars["a_{12}"] * vars["b_{23}"] +
      vars["a_{13}"] * vars["b_{33}"];
    vars["c_{21}"] =
      vars["a_{21}"] * vars["b_{11}"] +
      vars["a_{22}"] * vars["b_{21}"] +
      vars["a_{23}"] * vars["b_{31}"];
    vars["c_{22}"] =
      vars["a_{21}"] * vars["b_{12}"] +
      vars["a_{22}"] * vars["b_{22}"] +
      vars["a_{23}"] * vars["b_{32}"];
    vars["c_{23}"] =
      vars["a_{21}"] * vars["b_{13}"] +
      vars["a_{22}"] * vars["b_{23}"] +
      vars["a_{23}"] * vars["b_{33}"];
    vars["c_{31}"] =
      vars["a_{31}"] * vars["b_{11}"] +
      vars["a_{32}"] * vars["b_{21}"] +
      vars["a_{33}"] * vars["b_{31}"];
    vars["c_{32}"] =
      vars["a_{31}"] * vars["b_{12}"] +
      vars["a_{32}"] * vars["b_{22}"] +
      vars["a_{33}"] * vars["b_{32}"];
    vars["c_{33}"] =
      vars["a_{31}"] * vars["b_{13}"] +
      vars["a_{32}"] * vars["b_{23}"] +
      vars["a_{33}"] * vars["b_{33}"];
  },
};

const aKeys = [
  "a_{11}",
  "a_{12}",
  "a_{13}",
  "a_{21}",
  "a_{22}",
  "a_{23}",
  "a_{31}",
  "a_{32}",
  "a_{33}",
];
const bKeys = [
  "b_{11}",
  "b_{12}",
  "b_{13}",
  "b_{21}",
  "b_{22}",
  "b_{23}",
  "b_{31}",
  "b_{32}",
  "b_{33}",
];

const MatrixButtons = Custom(({ vars }) => {
  const resetAll = () => {
    [...aKeys, ...bKeys].forEach((k) => {
      vars[k] = 0;
    });
  };

  const identityA = () => {
    aKeys.forEach((k) => {
      vars[k] = 0;
    });
    vars["a_{11}"] = 1;
    vars["a_{22}"] = 1;
    vars["a_{33}"] = 1;
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={resetAll}
        className="px-4 py-2 bg-gradient-to-b from-white to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-800 rounded-xl transition-all border border-slate-300"
      >
        Reset All to Zero
      </button>
      <button
        onClick={identityA}
        className="px-4 py-2 bg-gradient-to-b from-white to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-800 rounded-xl transition-all border border-slate-300"
      >
        Identity Matrix A
      </button>
    </div>
  );
});

export const MatrixMultiplication: React.FC = () => {
  return (
    <Provider config={matrixConfig}>
      <Formula id="matrix-multiplication" />
      <MatrixButtons />
    </Provider>
  );
};

export default MatrixMultiplication;
