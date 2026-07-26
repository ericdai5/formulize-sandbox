import React from "react";
import { Formula, Provider, Graph, type Config } from "delta-dsl";
import "delta-dsl/style.css";

const config: Config = {
  formulas: [
    {
      id: "kinetic-energy",
      latex: "K = \\frac{1}{2}mv^2",
    },
  ],
  variables: {
    K: {
      name: "Kinetic energy",
    },
    m: {
      default: 1,
      range: [0, 10],
      input: "inline",
      name: "Mass",
      latexDisplay: "value",
      labelDisplay: "name",
    },
    v: {
      default: 2,
      range: [0, 10],
      input: "drag",
      name: "Velocity",
    },
  },
  semantics: function ({ vars, sample }) {
    vars.K = 0.5 * vars.m * Math.pow(vars.v, 2);
    sample("energy", { x: vars.v, y: vars.K });
  },
  graph2d: [
    {
      id: "energyGraph",
      xAxisVar: "v",
      yAxisVar: "K",
      lines: [
        {
          sampleId: "energy",
          parameter: "v",
          interaction: ["vertical-drag", "m"],
        },
      ],
      points: [
        {
          sampleId: "energy",
          interaction: ["horizontal-drag", "v"],
        },
      ],
    },
  ],
};

export const GalleryKineticEnergy: React.FC = () => {
  return (
    <Provider config={config}>
      <Formula id="kinetic-energy" />
      <Graph id="energyGraph" />
    </Provider>
  );
};

export default GalleryKineticEnergy;
