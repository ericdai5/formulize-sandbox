import React, { useEffect, useMemo, useState } from "react";

import {
  Custom,
  Formula,
  Provider,
  InlineVariable,
  EmbeddedFormula,
  Variable,
  type Config,
  type IFormula,
  type IVariablesUserInput,
} from "math-notation";

/**
 * Neural Network Forward Pass Example
 *
 * Demonstrates:
 * 1. Programmatic formula generation
 * 2. Custom visualization with EmbeddedFormula components at each node
 * 3. Formulas that expand on hover and have draggable input variables
 * 4. Real-time forward pass computation
 */

// Network architecture
const LAYERS = [3, 4, 4, 2];

// Activation function
const relu = (x: number) => Math.max(0, x);

// Layout constants
const VIZ_CONFIG = {
  width: 1200,
  height: 700,
  nodeRadius: 30,
  formulaWidth: 180,
  formulaHeight: 45,
  padding: 80, // padding from edges
};

const COLORS = {
  inputNode: "#4CAF50",
  hiddenNode: "#2196F3",
  outputNode: "#FF9800",
  nodeStroke: "#333",
  edgePositive: "#4CAF50",
  edgeNegative: "#F44336",
  edgeNeutral: "#aaa",
};

// =============================================================================
// Custom Neural Network Visualization
// =============================================================================

interface NodeInfo {
  id: string;
  layer: number;
  unit: number;
  x: number;
  y: number;
  type: "input" | "hidden" | "output";
  variableId: string;
  formulaId?: string;
}

const NeuralNetworkViz = Custom(({ vars }) => {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);

  const layers = LAYERS;

  // Build node positions - spread across available space
  useEffect(() => {
    const nodeList: NodeInfo[] = [];
    const padding = VIZ_CONFIG.padding;
    const usableWidth = VIZ_CONFIG.width - 2 * padding;
    const usableHeight = VIZ_CONFIG.height - 2 * padding - 40; // extra for labels at bottom

    // Calculate horizontal spacing to fill width
    const layerSpacing = usableWidth / (layers.length - 1);

    layers.forEach((layerSize, layerIdx) => {
      // Calculate vertical spacing for this layer to fill height
      const nodeSpacing = layerSize > 1 ? usableHeight / (layerSize - 1) : 0;
      const startY = layerSize > 1 ? padding + 30 : VIZ_CONFIG.height / 2; // +30 for formula above

      for (let unit = 1; unit <= layerSize; unit++) {
        const x = padding + layerIdx * layerSpacing;
        const y = layerSize > 1 ? startY + (unit - 1) * nodeSpacing : startY;

        const variableId =
          layerIdx === 0 ? `x_${unit}` : `h_{${unit},${layerIdx}}`;
        const formulaId =
          layerIdx === 0 ? undefined : `formula_h_${unit}_${layerIdx}`;

        nodeList.push({
          id: `node_${layerIdx}_${unit}`,
          layer: layerIdx,
          unit,
          x,
          y,
          type:
            layerIdx === 0
              ? "input"
              : layerIdx === layers.length - 1
                ? "output"
                : "hidden",
          variableId,
          formulaId,
        });
      }
    });

    setNodes(nodeList);
  }, [layers]);

  // Generate edges using vars injected by Custom.define
  const edges: {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    width: number;
  }[] = [];

  for (let l = 1; l < layers.length; l++) {
    const currNodes = nodes.filter((n) => n.layer === l);
    const prevNodes = nodes.filter((n) => n.layer === l - 1);

    for (const curr of currNodes) {
      for (const prev of prevNodes) {
        const weightId = `w_{${curr.unit},${prev.unit},${l}}`;
        const weight = vars[weightId] ?? 0;

        const color =
          weight > 0.05
            ? COLORS.edgePositive
            : weight < -0.05
              ? COLORS.edgeNegative
              : COLORS.edgeNeutral;
        const width = Math.max(0.5, Math.min(Math.abs(weight) * 2, 3));

        edges.push({
          key: `edge_${l}_${prev.unit}_${curr.unit}`,
          x1: prev.x + VIZ_CONFIG.nodeRadius,
          y1: prev.y,
          x2: curr.x - VIZ_CONFIG.nodeRadius,
          y2: curr.y,
          color,
          width,
        });
      }
    }
  }

  const getNodeColor = (type: NodeInfo["type"]) => {
    switch (type) {
      case "input":
        return COLORS.inputNode;
      case "output":
        return COLORS.outputNode;
      default:
        return COLORS.hiddenNode;
    }
  };

  const getAbbreviation = (node: NodeInfo) => {
    if (node.layer === 0) return `x_${node.unit}`;
    return `h_{${node.unit},${node.layer}}`;
  };

  return (
    <svg
      width={VIZ_CONFIG.width}
      height={VIZ_CONFIG.height}
      viewBox={`0 0 ${VIZ_CONFIG.width} ${VIZ_CONFIG.height}`}
      className="border border-gray-200 rounded-lg bg-white mx-auto block"
    >
      {/* Edges */}
      <g className="edges">
        {edges.map((edge) => (
          <line
            key={edge.key}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={edge.color}
            strokeWidth={edge.width}
            strokeOpacity={0.6}
          />
        ))}
      </g>

      {/* Nodes */}
      <g className="nodes">
        {nodes.map((node) => {
          const val = vars[node.variableId];
          const displayVal = typeof val === "number" ? val.toFixed(2) : "?";

          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              {/* Formula above node */}
              <foreignObject
                x={-VIZ_CONFIG.formulaWidth / 2}
                y={-VIZ_CONFIG.nodeRadius - VIZ_CONFIG.formulaHeight - 3}
                width={VIZ_CONFIG.formulaWidth}
                height={VIZ_CONFIG.formulaHeight}
                style={{ overflow: "visible" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  {node.formulaId ? (
                    <EmbeddedFormula
                      id={node.formulaId}
                      abbreviation={getAbbreviation(node)}
                      scale={0.9}
                      highlightOnHover={true}
                      allowPinning={false}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    />
                  ) : (
                    <EmbeddedFormula
                      id={`input_display_${node.variableId}`}
                      latex={getAbbreviation(node)}
                      scale={0.9}
                      highlightOnHover={false}
                      allowPinning={false}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        borderRadius: "4px",
                        padding: "4px 8px",
                      }}
                    />
                  )}
                </div>
              </foreignObject>

              {/* Node circle */}
              <circle
                r={VIZ_CONFIG.nodeRadius}
                fill={getNodeColor(node.type)}
                stroke={COLORS.nodeStroke}
                strokeWidth={1.5}
              />

              {/* Value inside */}
              <text
                y={5}
                textAnchor="middle"
                fontSize="14px"
                fontWeight="bold"
                fill="white"
                style={{ pointerEvents: "none" }}
              >
                {displayVal}
              </text>
            </g>
          );
        })}
      </g>

      {/* Layer labels */}
      <g className="labels">
        {layers.map((_, i) => {
          const padding = VIZ_CONFIG.padding;
          const usableWidth = VIZ_CONFIG.width - 2 * padding;
          const layerSpacing = usableWidth / (layers.length - 1);
          const x = padding + i * layerSpacing;
          const label =
            i === 0
              ? "Input"
              : i === layers.length - 1
                ? "Output"
                : `Hidden ${i}`;
          return (
            <text
              key={i}
              x={x}
              y={VIZ_CONFIG.height - 15}
              textAnchor="middle"
              fontSize="15px"
              fontWeight="500"
              fill="#555"
            >
              {label}
            </text>
          );
        })}
      </g>
    </svg>
  );
});

// =============================================================================
// Generate Neural Network Configuration
// =============================================================================

function generateNeuralNetwork(layers: number[]) {
  const formulas: IFormula[] = [];
  const variables: IVariablesUserInput = {};

  // Input variables
  const inputVars = Variable.vector("x", layers[0], {
    input: "drag",
    default: () => Math.round((Math.random() * 2 - 1) * 100) / 100,
    range: [-2, 2],
    step: 0.05,
    precision: 2,
  });
  Object.assign(variables, inputVars);

  // For each layer after input
  for (let l = 1; l < layers.length; l++) {
    const currSize = layers[l];
    const prevSize = layers[l - 1];

    // Weights - use valid LaTeX subscript notation
    const weights = Variable.loop(
      { i: [1, currSize], j: [1, prevSize] },
      ({ i, j }) => [
        `w_{${i},${j},${l}}`,
        {
          input: "drag",
          default: Math.round((Math.random() * 2 - 1) * 100) / 100,
          range: [-2, 2],
          step: 0.05,
          precision: 2,
        },
      ],
    );
    Object.assign(variables, weights);

    // Biases - use valid LaTeX subscript notation
    for (let i = 1; i <= currSize; i++) {
      variables[`b_{${i},${l}}`] = {
        input: "drag",
        default: 0,
        range: [-2, 2],
        step: 0.05,
        precision: 2,
      };
    }

    // Computed variables and formulas - use valid LaTeX subscript notation
    for (let i = 1; i <= currSize; i++) {
      variables[`z_{${i},${l}}`] = { precision: 3 };
      variables[`h_{${i},${l}}`] = { precision: 3 };

      // Formula for h: shows the full computation with expanded terms
      // Variable IDs now use valid LaTeX notation directly
      const terms: string[] = [];
      for (let j = 1; j <= prevSize; j++) {
        const weightVar = `w_{${i},${j},${l}}`;
        const inputVar = l === 1 ? `x_${j}` : `h_{${j},${l - 1}}`;
        terms.push(`${weightVar} \\cdot ${inputVar}`);
      }
      const biasVar = `b_{${i},${l}}`;
      const sumExpr = terms.join(" + ");
      const latex = `h_{${i},${l}} = \\text{ReLU}\\left(${sumExpr} + ${biasVar}\\right)`;

      formulas.push({
        id: `formula_h_${i}_${l}`,
        latex,
      });
    }
  }

  // Computation function - uses valid LaTeX variable IDs
  const manual = (vars: Record<string, number>) => {
    for (let l = 1; l < layers.length; l++) {
      const currSize = layers[l];
      const prevSize = layers[l - 1];
      for (let i = 1; i <= currSize; i++) {
        let z = 0;
        for (let j = 1; j <= prevSize; j++) {
          const w = vars[`w_{${i},${j},${l}}`] ?? 0;
          const input =
            l === 1 ? vars[`x_${j}`] ?? 0 : vars[`h_{${j},${l - 1}}`] ?? 0;
          z += w * input;
        }
        z += vars[`b_{${i},${l}}`] ?? 0;
        vars[`z_{${i},${l}}`] = z;
        vars[`h_{${i},${l}}`] = relu(z);
      }
    }
  };

  return { formulas, variables, manual };
}

// =============================================================================
// Main Component
// =============================================================================

export const NeuralNetworkExample: React.FC = () => {
  const { formulas, variables, manual } = useMemo(
    () => generateNeuralNetwork(LAYERS),
    [],
  );

  const config: Config = useMemo(
    () => ({
      formulas,
      variables,
      semantics: ({ vars }) => manual(vars),
    }),
    [formulas, variables, manual],
  );

  const totalWeights = LAYERS.slice(1).reduce(
    (sum, n, i) => sum + n * LAYERS[i],
    0,
  );
  const totalBiases = LAYERS.slice(1).reduce((sum, n) => sum + n, 0);

  return (
    <Provider config={config}>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-4xl font-bold mb-2">
          Understanding Neural Networks
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          An interactive exploration of the forward pass
        </p>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            You've probably heard that neural networks are complicated. They're
            not, really. The basic idea is almost disappointingly simple:
            multiply some numbers together, add them up, and squash the result.
            That's it. The magic comes from doing this thousands of times across
            layers of interconnected nodes.
          </p>

          <p className="mb-6">
            The network below has {LAYERS[0]} inputs feeding into two hidden
            layers of {LAYERS[1]} neurons, which then produce{" "}
            {LAYERS[LAYERS.length - 1]} outputs. Hover over any node's formula
            to see what it's actually computing. Better yet, drag any number and
            watch the changes cascade through the entire network.
          </p>
        </div>

        {/* Visualization */}
        <div className="my-10">
          <div className="h-[750px]">
            <NeuralNetworkViz />
          </div>
        </div>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            This network takes three input values:{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-green-50 px-2 py-0.5 rounded">
              x₁ = <InlineVariable id="x_1" display="value" />
            </span>
            ,{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-green-50 px-2 py-0.5 rounded">
              x₂ = <InlineVariable id="x_2" display="value" />
            </span>
            , and{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-green-50 px-2 py-0.5 rounded">
              x₃ = <InlineVariable id="x_3" display="value" />
            </span>
            . In a real application, these might be pixel values from an image,
            readings from a sensor, or any numerical features you want the
            network to learn from.
          </p>

          <p className="mb-6">
            Every connection between neurons has a <strong>weight</strong> that
            controls how much influence flows through it. The weights connecting
            our three inputs to the first hidden neuron are{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-purple-50 px-2 py-0.5 rounded">
              <InlineVariable id="w_{1,1,1}" display="value" />
            </span>
            ,{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-purple-50 px-2 py-0.5 rounded">
              <InlineVariable id="w_{1,2,1}" display="value" />
            </span>
            , and{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-purple-50 px-2 py-0.5 rounded">
              <InlineVariable id="w_{1,3,1}" display="value" />
            </span>
            . When a weight is positive, it amplifies the signal. When it's
            negative, it suppresses it. Go ahead and drag one of these to see
            what happens.
          </p>

          <p className="mb-6">
            You can see this reflected in the visualization above. The lines
            between nodes are colored{" "}
            <span className="text-green-600 font-medium">green</span> for
            positive weights and{" "}
            <span className="text-red-500 font-medium">red</span> for negative
            ones. The thickness of each line shows the magnitude: stronger
            weights produce thicker lines, while weights close to zero fade to
            thin gray.
          </p>

          <p className="mb-6">
            Each neuron also has a <strong>bias</strong> term (the first hidden
            neuron's is{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-amber-50 px-2 py-0.5 rounded">
              b₁ = <InlineVariable id="b_{1,1}" display="value" />
            </span>
            ) that shifts when the neuron "fires." Think of it as a threshold
            adjustment. Without biases, networks would be surprisingly limited
            in what they could learn.
          </p>

          <p className="mb-6">
            So what does a neuron actually do? It takes all its inputs,
            multiplies each one by the corresponding weight, adds everything
            together including the bias, and then applies an{" "}
            <strong>activation function</strong>. We're using{" "}
            <strong>ReLU</strong> here, which just means: if the result is
            negative, output zero; otherwise, pass it through unchanged. Written
            as code:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-base">
              max(0, x)
            </code>
            .
          </p>

          <p className="mb-6">
            Here's the complete formula for the first hidden neuron. Try
            dragging any of the values to see the computation update in real
            time:
          </p>
        </div>

        <div className="my-8 bg-gray-50 rounded-xl p-4 border">
          <Formula
            id="formula_h_1_1"
            style={{ height: "280px", width: "100%" }}
          />
        </div>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            Information flows through the network one layer at a time. Each
            neuron in a hidden layer connects to every neuron in the previous
            layer, computes its weighted sum, and passes the result forward. By
            the time we reach the end, the network has produced its final
            outputs:
          </p>

          <div className="flex gap-6 justify-center my-8">
            {Array.from({ length: LAYERS[LAYERS.length - 1] }, (_, i) => (
              <div key={i} className="text-center bg-orange-50 rounded-lg p-4">
                <div className="text-sm text-orange-600 mb-1">
                  Output {i + 1}
                </div>
                <div className="text-3xl font-mono font-bold text-orange-700">
                  <InlineVariable
                    id={`h_{${i + 1},${LAYERS.length - 1}}`}
                    display="value"
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mb-6">
            Count them up and this little network has {totalWeights} weights and{" "}
            {totalBiases} biases, which means {totalWeights + totalBiases}{" "}
            numbers control its behavior. In practice, these values get learned
            automatically through a process called <strong>training</strong>:
            you show the network thousands of examples, it makes predictions,
            you tell it how wrong it was, and it adjusts the weights to do
            better next time. Here, you get to play that role yourself.
          </p>

          <p className="mb-6">
            The real power of neural networks isn't in any single neuron. It's
            in depth and composition. The first layer might learn to detect
            edges in an image. The next layer combines those edges into shapes.
            The layer after that recognizes objects. Stack enough of these
            transformations together and you can approximate almost any
            function.
          </p>

          <p className="text-gray-500 text-base mt-10">
            This visualization includes {formulas.length} interconnected
            formulas, all updating together whenever you change a value.
          </p>
        </div>
      </div>
    </Provider>
  );
};

export default NeuralNetworkExample;
