import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

import {
  Custom,
  Formula,
  Provider,
  InlineFormula,
  InlineVariable,
  type Config,
} from "math-notation";
import "math-notation/style.css";

const bayesConfig: Config = {
  formulas: [
    {
      id: "bayes-theorem",
      latex: "P(B \\mid A) = \\frac{P(A \\mid B)P(B)}{P(A)}",
    },
    {
      id: "conditional-probability",
      latex: "P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}",
    },
    {
      id: "a-and-not-b",
      latex: "P(A \\cap \\neg B) = P(A) - P(A \\cap B)",
    },
    {
      id: "b-and-not-a",
      latex: "P(B \\cap \\neg A) = P(B) - P(A \\cap B)",
    },
    {
      id: "not-a-and-not-b",
      latex: "P(\\neg A \\cap \\neg B) = 1 - P(A) - P(B) + P(A \\cap B)",
    },
  ],
  variables: {
    "P(B \\mid A)": {
      name: "P(B|A)",
      precision: 4,
    },
    "P(A \\mid B)": {
      name: "P(A|B)",
      precision: 4,
    },
    "P(A \\cap B)": {
      input: "drag",
      default: 0.1,
      range: [0, 1],
      step: 0.01,
      name: "P(A and B)",
      precision: 3,
    },
    "P(A \\cap \\neg B)": {
      name: "P(A and not B)",
      precision: 3,
    },
    "P(B \\cap \\neg A)": {
      name: "P(B and not A)",
      precision: 3,
    },
    "P(\\neg A \\cap \\neg B)": {
      name: "P(not A and not B)",
      precision: 3,
    },
    "P(B)": {
      input: "drag",
      default: 0.2,
      range: [0, 1],
      step: 0.01,
      name: "P(B)",
      precision: 3,
    },
    "P(A)": {
      input: "drag",
      default: 0.2,
      range: [0, 1],
      step: 0.01,
      name: "P(A)",
      precision: 3,
    },
  },
  semantics: function ({ vars }) {
    // Compute all the derived probabilities
    const pAandB = vars["P(A \\cap B)"];
    const pA = vars["P(A)"];
    const pB = vars["P(B)"];

    // Conditional probabilities
    const pAgivenB = pB > 0 ? pAandB / pB : 0;
    const pBgivenA = pA > 0 ? (pAgivenB * pB) / pA : 0;

    // Complement intersections
    const pAandNotB = pA - pAandB;
    const pBandNotA = pB - pAandB;
    const pNotAandNotB = 1 - pA - pB + pAandB;

    // Set computed values
    vars["P(B \\mid A)"] = pBgivenA;
    vars["P(A \\mid B)"] = pAgivenB;
    vars["P(A \\cap \\neg B)"] = pAandNotB;
    vars["P(B \\cap \\neg A)"] = pBandNotA;
    vars["P(\\neg A \\cap \\neg B)"] = pNotAandNotB;
  },
};

// BayesProbabilityChart - Custom visualization component
const BayesProbabilityChart = Custom(({ vars }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();
  const ballIdRef = useRef(0);

  const [isRunning, setIsRunning] = useState(true);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [dropFrequency, setDropFrequency] = useState(0.15);
  const [stats, setStats] = useState<Statistics>({
    redOnly: 0,
    blueOnly: 0,
    both: 0,
    neither: 0,
    total: 0,
  });

  // Get probabilities from vars
  const getContextProbabilities = () => {
    const pA = vars["P(A)"] || 0.2;
    const pB = vars["P(B)"] || 0.2;
    const pAandB = vars["P(A \\cap B)"] || 0.1;
    const pAandNotB = vars["P(A \\cap \\neg B)"] || 0.1;
    const pBandNotA = vars["P(B \\cap \\neg A)"] || 0.1;
    const pNotAandNotB = vars["P(\\neg A \\cap \\neg B)"] || 0.7;
    return {
      pA,
      pB,
      pAandB,
      pAandNotB,
      pBandNotA,
      pNotAandNotB,
    };
  };

  const contextProbs = getContextProbabilities();
  const expectedProportions = {
    redOnly: contextProbs.pAandNotB,
    blueOnly: contextProbs.pBandNotA,
    both: contextProbs.pAandB,
    neither: contextProbs.pNotAandNotB,
  };

  const actualProportions = {
    redOnly: stats.total > 0 ? stats.redOnly / stats.total : 0,
    blueOnly: stats.total > 0 ? stats.blueOnly / stats.total : 0,
    both: stats.total > 0 ? stats.both / stats.total : 0,
    neither: stats.total > 0 ? stats.neither / stats.total : 0,
  };

  // Calculate dynamic shelf layout based on probabilities
  const getDynamicShelfLayout = () => {
    const { pA, pB, pAandB } = getContextProbabilities();
    const ballSpawnWidth = CONFIG.width - 100;
    const ballSpawnStart = 50;
    const redWidth = Math.max(pA * ballSpawnWidth, 20);
    const blueWidth = Math.max(pB * ballSpawnWidth, 20);
    const overlapWidth = Math.max(pAandB * ballSpawnWidth, 0);
    const totalSystemWidth = redWidth + blueWidth - overlapWidth;
    const systemStartX =
      ballSpawnStart + (ballSpawnWidth - totalSystemWidth) / 2;
    const redShelfX = systemStartX;
    const blueShelfX = redShelfX + redWidth - overlapWidth;
    const actualOverlapWidth = Math.max(0, redShelfX + redWidth - blueShelfX);

    return {
      redShelfX,
      redWidth,
      blueShelfX,
      blueWidth,
      overlapWidth: actualOverlapWidth,
      ballSpawnStart,
      ballSpawnWidth,
    };
  };

  const {
    redShelfX,
    redWidth,
    blueShelfX,
    blueWidth,
    ballSpawnStart,
    ballSpawnWidth,
  } = getDynamicShelfLayout();

  // Animation loop
  const animate = useCallback(() => {
    if (!isRunning) return;

    setBalls((currentBalls) => {
      let newBalls = [...currentBalls];
      const spawnCount =
        Math.random() < dropFrequency ? Math.floor(Math.random() * 3) + 1 : 0;

      for (let i = 0; i < spawnCount; i++) {
        const newBall: Ball = {
          id: ballIdRef.current++,
          x: ballSpawnStart + Math.random() * ballSpawnWidth,
          y: -20,
          vx: 0,
          vy: Math.random() * 0.5,
          radius: CONFIG.ballRadius,
          hitRed: false,
          hitBlue: false,
          active: true,
          bounceCount: 0,
        };
        newBalls.push(newBall);
      }

      // Update physics for all balls
      newBalls = newBalls.map((ball) => {
        if (!ball.active) return ball;

        ball.vy += CONFIG.gravity * CONFIG.speedMultiplier;
        ball.x += ball.vx * CONFIG.speedMultiplier;
        ball.y += ball.vy * CONFIG.speedMultiplier;

        // Check collision with red shelf
        if (
          !ball.hitRed &&
          ball.x + ball.radius > redShelfX &&
          ball.x - ball.radius < redShelfX + redWidth &&
          ball.y + ball.radius > CONFIG.redShelfY &&
          ball.y - ball.radius < CONFIG.redShelfY + CONFIG.shelfHeight
        ) {
          ball.hitRed = true;
          ball.y = CONFIG.redShelfY - ball.radius;
          ball.vy = -Math.abs(ball.vy) * 0.4;
          ball.vx = 0;
        }

        // Check collision with blue shelf
        if (
          !ball.hitBlue &&
          ball.x + ball.radius > blueShelfX &&
          ball.x - ball.radius < blueShelfX + blueWidth &&
          ball.y + ball.radius > CONFIG.blueShelfY &&
          ball.y - ball.radius < CONFIG.blueShelfY + CONFIG.shelfHeight
        ) {
          ball.hitBlue = true;
          ball.y = CONFIG.blueShelfY - ball.radius;
          ball.vy = -Math.abs(ball.vy) * 0.4;
          ball.vx = 0;
        }

        // Check collision with bottom
        if (ball.y + ball.radius > CONFIG.height) {
          if (ball.bounceCount < 4 && Math.abs(ball.vy) > 0.2) {
            ball.y = CONFIG.height - ball.radius;
            ball.vy = -ball.vy * 0.35;
            ball.vx = 0;
            ball.bounceCount++;
          } else {
            ball.active = false;
          }
        }

        if (
          ball.y > CONFIG.height + 100 ||
          (ball.bounceCount >= 4 && Math.abs(ball.vy) < 0.1)
        ) {
          ball.active = false;
        }

        return ball;
      });

      // Count statistics for inactive balls
      const inactiveBalls = newBalls.filter((ball) => !ball.active);
      if (inactiveBalls.length > 0) {
        setStats((prevStats) => {
          const newStats = { ...prevStats };
          inactiveBalls.forEach((ball) => {
            if (ball.hitRed && ball.hitBlue) {
              newStats.both++;
            } else if (ball.hitRed && !ball.hitBlue) {
              newStats.redOnly++;
            } else if (!ball.hitRed && ball.hitBlue) {
              newStats.blueOnly++;
            } else {
              newStats.neither++;
            }
            newStats.total++;
          });
          return newStats;
        });
      }

      return newBalls.filter((ball) => ball.active);
    });
  }, [
    isRunning,
    dropFrequency,
    redShelfX,
    redWidth,
    blueShelfX,
    blueWidth,
    ballSpawnStart,
    ballSpawnWidth,
  ]);

  // Animation loop effect
  useEffect(() => {
    if (isRunning) {
      const animateLoop = () => {
        animate();
        animationRef.current = requestAnimationFrame(animateLoop);
      };
      animationRef.current = requestAnimationFrame(animateLoop);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, animate]);

  // Render visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    let g = svg.select<SVGGElement>("g.main-group");
    if (g.empty()) {
      svg.selectAll("*").remove();
      g = svg.append("g").attr("class", "main-group");
    }

    // Update shelves
    g.selectAll(".red-shelf, .blue-shelf, .red-label, .blue-label").remove();

    g.append("rect")
      .attr("class", "red-shelf")
      .attr("x", redShelfX)
      .attr("y", CONFIG.redShelfY)
      .attr("width", redWidth)
      .attr("height", CONFIG.shelfHeight)
      .attr("fill", COLORS.red);

    g.append("rect")
      .attr("class", "blue-shelf")
      .attr("x", blueShelfX)
      .attr("y", CONFIG.blueShelfY)
      .attr("width", blueWidth)
      .attr("height", CONFIG.shelfHeight)
      .attr("fill", COLORS.blue);

    g.append("text")
      .attr("class", "red-label")
      .attr("x", redShelfX + redWidth / 2)
      .attr("y", CONFIG.redShelfY - 10)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.red)
      .attr("font-size", "16px")
      .text("A");

    g.append("text")
      .attr("class", "blue-label")
      .attr("x", blueShelfX + blueWidth / 2)
      .attr("y", CONFIG.blueShelfY - 10)
      .attr("text-anchor", "middle")
      .attr("fill", COLORS.blue)
      .attr("font-size", "16px")
      .text("B");

    // Update balls
    const ballsSelection = g
      .selectAll<SVGCircleElement, Ball>("circle.ball")
      .data(balls, (d: Ball) => d.id.toString());

    ballsSelection
      .enter()
      .append("circle")
      .attr("class", "ball")
      .attr("r", (d: Ball) => d.radius);

    g.selectAll<SVGCircleElement, Ball>("circle.ball")
      .attr("cx", (d: Ball) => d.x)
      .attr("cy", (d: Ball) => d.y)
      .attr("fill", (d: Ball) => {
        if (d.hitRed && d.hitBlue) return COLORS.purple;
        if (d.hitRed) return COLORS.red;
        if (d.hitBlue) return COLORS.blue;
        return COLORS.gray;
      });

    ballsSelection.exit().remove();
  }, [balls, redShelfX, redWidth, blueShelfX, blueWidth]);

  const toggleAnimation = () => setIsRunning(!isRunning);

  const reset = () => {
    setIsRunning(false);
    setBalls([]);
    setDropFrequency(0.15);
    setStats({ redOnly: 0, blueOnly: 0, both: 0, neither: 0, total: 0 });
    ballIdRef.current = 0;
  };

  // ProportionBar component
  const ProportionBar = ({
    label,
    proportions,
  }: {
    label: string;
    proportions: {
      redOnly: number;
      blueOnly: number;
      both: number;
      neither: number;
    };
  }) => (
    <div className="mb-4">
      <div className="text-sm font-medium mb-2 text-gray-700">{label}</div>
      <div className="relative">
        <svg width={600} height={10} className="border border-slate-200 rounded">
          <rect width={600} height={10} fill="#f3f4f6" />
          <rect
            x={0}
            y={0}
            width={proportions.redOnly * 600}
            height={10}
            fill={COLORS.red}
          />
          <rect
            x={proportions.redOnly * 600}
            y={0}
            width={proportions.blueOnly * 600}
            height={10}
            fill={COLORS.blue}
          />
          <rect
            x={(proportions.redOnly + proportions.blueOnly) * 600}
            y={0}
            width={proportions.both * 600}
            height={10}
            fill={COLORS.purple}
          />
          <rect
            x={
              (proportions.redOnly + proportions.blueOnly + proportions.both) *
              600
            }
            y={0}
            width={proportions.neither * 600}
            height={10}
            fill={COLORS.gray}
          />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="bayes-probability-chart w-full h-full p-4 bg-slate-50 flex flex-col overflow-auto gap-3">
      <div className="p-4 bg-white rounded-lg border border-slate-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Drop Frequency: {(dropFrequency * 60).toFixed(0)} balls/sec
        </label>
        <input
          type="range"
          min="0.05"
          max="0.5"
          step="0.05"
          value={dropFrequency}
          onChange={(e) => setDropFrequency(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Slow</span>
          <span>Fast</span>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={toggleAnimation}
          className={`px-4 py-2 rounded-xl font-medium ${
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          }`}
        >
          {isRunning ? "Pause" : "Start"} Simulation
        </button>
        <button
          onClick={reset}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-medium"
        >
          Reset
        </button>
        <div className="text-sm text-gray-600">Total balls: {stats.total}</div>
      </div>

      <div className="flex-1">
        <svg
          ref={svgRef}
          width={CONFIG.width}
          height={CONFIG.height}
          className="border border-slate-200 bg-white rounded-lg"
          viewBox={`0 0 ${CONFIG.width} ${CONFIG.height}`}
        />
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <ProportionBar label="Expected" proportions={expectedProportions} />
        <ProportionBar label="Actual" proportions={actualProportions} />
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.red }}
            />
            <span className="font-mono text-lg text-gray-700 ml-auto">
              {contextProbs.pAandNotB.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.blue }}
            />
            <span className="font-mono text-lg text-gray-700 ml-auto">
              {contextProbs.pBandNotA.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.purple }}
            />
            <span className="font-mono text-lg text-gray-700 ml-auto">
              {contextProbs.pAandB.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: COLORS.gray }}
            />
            <span className="font-mono text-lg text-gray-700 ml-auto">
              {contextProbs.pNotAandNotB.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Types and constants needed for BayesProbabilityChart
interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hitRed: boolean;
  hitBlue: boolean;
  active: boolean;
  bounceCount: number;
}

interface Statistics {
  redOnly: number;
  blueOnly: number;
  both: number;
  neither: number;
  total: number;
}

const CONFIG = {
  width: 675,
  height: 300,
  redShelfY: 100,
  blueShelfY: 200,
  shelfWidth: 300,
  shelfHeight: 6,
  redShelfX: 150,
  blueShelfX: 350,
  gravity: 0.05,
  ballSpawnRate: 0.15,
  ballRadius: 4,
  speedMultiplier: 0.5,
};

const COLORS = {
  red: "#C03A2B",
  blue: "#2980B9",
  purple: "#9B59B6",
  gray: "#CCCCCC",
};

export const BayesVisualizationExample: React.FC = () => {
  return (
    <Provider config={bayesConfig}>
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">
          Bayes' Theorem Interactive Visualization
        </h2>

        <div className="prose max-w-none mb-6">
          <p className="text-gray-700 leading-relaxed mb-4">
            Bayes' theorem <InlineFormula id="bayes-theorem" scale={0.9} /> is
            fundamental to probability theory and statistical inference. It
            describes how to update our beliefs based on new evidence.
          </p>

          <p className="text-gray-700 leading-relaxed mb-4">
            The conditional probability formula{" "}
            <InlineFormula id="conditional-probability" scale={0.9} /> shows
            that <InlineVariable id="P(A \mid B)" display="both" /> depends on
            the joint probability
            <InlineVariable id="P(A \cap B)" display="both" /> and the marginal
            probability
            <InlineVariable id="P(B)" display="both" />.
          </p>

          <p className="text-gray-700 leading-relaxed mb-4">
            With current settings: <InlineVariable id="P(A)" display="both" />,{" "}
            <InlineVariable id="P(B)" display="both" />, and{" "}
            <InlineVariable id="P(A \cap B)" display="both" />, we can
            calculate:
          </p>

          <ul className="list-disc list-inside text-gray-700 mb-4">
            <li>
              <InlineVariable id="P(B \mid A)" display="both" />
            </li>
            <li>
              <InlineVariable id="P(A \mid B)" display="both" />
            </li>
            <li>
              <InlineVariable id="P(A \cap \neg B)" display="both" />
            </li>
            <li>
              <InlineVariable id="P(B \cap \neg A)" display="both" />
            </li>
            <li>
              <InlineVariable id="P(\neg A \cap \neg B)" display="both" />
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulas Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Key Formulas</h3>
            <Formula id="bayes-theorem" />
            <Formula id="conditional-probability" />
            <Formula id="a-and-not-b" />
            <Formula id="b-and-not-a" />
            <Formula id="not-a-and-not-b" />
          </div>

          {/* Visualization Column */}
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Interactive Probability Simulation
            </h3>
            <BayesProbabilityChart />
            <p className="text-sm text-gray-600 mt-4">
              Watch balls fall through event shelves A and B to visualize
              probability distributions. The simulation shows how events
              interact and accumulate over time.
            </p>
          </div>
        </div>
      </div>
    </Provider>
  );
};

export default BayesVisualizationExample;
