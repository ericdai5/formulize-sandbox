import React, { useCallback, useState } from "react";

import {
  Custom,
  Formula,
  Provider,
  InlineFormula,
  InlineVariable,
  type Config,
} from "math-notation";

// ============================================================================
// Race Order Visualization Component
// ============================================================================

type Animal = "T" | "H";

interface RacePosition {
  position: number; // 1-12 (also the rank)
  animal: Animal;
}

/**
 * Converts formula variable values to race order
 * Variables t_1...t_6 contain tortoise ranks, h_1...h_6 contain hare ranks
 */
function variablesToRaceOrder(
  getVariable: (name: string) => number,
): RacePosition[] {
  const positions: RacePosition[] = [];

  // Get tortoise ranks
  for (let i = 1; i <= 6; i++) {
    const rank = Math.round(getVariable(`t_${i}`));
    if (rank >= 1 && rank <= 12) {
      positions.push({ position: rank, animal: "T" });
    }
  }

  // Get hare ranks
  for (let i = 1; i <= 6; i++) {
    const rank = Math.round(getVariable(`h_${i}`));
    if (rank >= 1 && rank <= 12) {
      positions.push({ position: rank, animal: "H" });
    }
  }

  // Sort by position
  positions.sort((a, b) => a.position - b.position);

  return positions;
}

/**
 * Converts race order to formula variable values
 * Returns null if the race order is invalid (duplicate ranks)
 */
function raceOrderToVariables(
  raceOrder: RacePosition[],
): { tortoiseRanks: number[]; hareRanks: number[] } | null {
  const tortoiseRanks: number[] = [];
  const hareRanks: number[] = [];
  const usedRanks = new Set<number>();

  for (const pos of raceOrder) {
    if (usedRanks.has(pos.position)) {
      return null; // Duplicate rank
    }
    usedRanks.add(pos.position);

    if (pos.animal === "T") {
      tortoiseRanks.push(pos.position);
    } else {
      hareRanks.push(pos.position);
    }
  }

  if (tortoiseRanks.length !== 6 || hareRanks.length !== 6) {
    return null; // Invalid count
  }

  return { tortoiseRanks, hareRanks };
}

/**
 * Check if current formula values represent a valid race (no duplicate ranks)
 */
function isValidRaceOrder(getVariable: (name: string) => number): boolean {
  const ranks = new Set<number>();

  for (let i = 1; i <= 6; i++) {
    const tRank = Math.round(getVariable(`t_${i}`));
    const hRank = Math.round(getVariable(`h_${i}`));

    if (ranks.has(tRank) || ranks.has(hRank)) return false;
    if (tRank < 1 || tRank > 12 || hRank < 1 || hRank > 12) return false;

    ranks.add(tRank);
    ranks.add(hRank);
  }

  return ranks.size === 12;
}

const RaceOrderVisualizationInner = Custom(({ vars }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Helper to get variable value
  const getVar = useCallback(
    (name: string): number => {
      const value = vars[name];
      return typeof value === "number" ? value : 0;
    },
    [vars],
  );

  const isValid = isValidRaceOrder(getVar);
  // Keep rendering the current state even when invalid so users can see duplicates.
  const raceOrder = variablesToRaceOrder(getVar);

  // Update formula variables when race order changes via drag
  const updateFormulaFromRaceOrder = useCallback(
    (newOrder: RacePosition[]) => {
      const result = raceOrderToVariables(newOrder);
      if (!result) return;

      const { tortoiseRanks, hareRanks } = result;

      // Update tortoise variables
      tortoiseRanks.forEach((rank, i) => {
        vars[`t_${i + 1}`] = rank;
      });

      // Update hare variables
      hareRanks.forEach((rank, i) => {
        vars[`h_${i + 1}`] = rank;
      });
    },
    [vars],
  );

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Handle drop - swap animals between positions
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    // Swap the animals at these positions
    const newOrder = [...raceOrder];
    const draggedAnimal = newOrder[draggedIndex].animal;
    const targetAnimal = newOrder[targetIndex].animal;

    newOrder[draggedIndex] = {
      ...newOrder[draggedIndex],
      animal: targetAnimal,
    };
    newOrder[targetIndex] = { ...newOrder[targetIndex], animal: draggedAnimal };

    updateFormulaFromRaceOrder(newOrder);
    setDraggedIndex(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="my-8 p-6 bg-white border rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Race Finish Order
        </h3>
        {!isValid && (
          <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Invalid ranks (duplicates detected)
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Drag animals to reorder the race results. Position 1 is first place
        (rank 1).
      </p>

      {/* Race track visualization */}
      <div className="flex items-end gap-1">
        {/* Finish line */}
        <div className="flex flex-col items-center mr-2">
          <div className="w-1 h-16 bg-gradient-to-b from-black via-white to-black bg-[length:100%_8px]" />
          <span className="text-xs text-gray-400 mt-1">Finish</span>
        </div>

        {/* Race positions */}
        {raceOrder.map((pos, index) => (
          <div
            key={`${pos.animal}-${pos.position}-${index}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              flex flex-col items-center cursor-grab active:cursor-grabbing
              transition-transform duration-150
              ${
                draggedIndex === index
                  ? "scale-110 opacity-50"
                  : "hover:scale-105"
              }
            `}
          >
            {/* Animal icon */}
            <div
              className={`
                w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold
                shadow-md border-2 transition-colors
                ${
                  pos.animal === "T"
                    ? "bg-green-100 border-green-400 text-green-700"
                    : "bg-orange-100 border-orange-400 text-orange-700"
                }
              `}
            >
              {pos.animal === "T" ? "🐢" : "🐇"}
            </div>

            {/* Position label */}
            <div className="mt-1 text-xs font-medium text-gray-600">
              {pos.position}
              {pos.position === 1
                ? "st"
                : pos.position === 2
                  ? "nd"
                  : pos.position === 3
                    ? "rd"
                    : "th"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Mann-Whitney U Test Example
// Based on the Wikipedia "Tortoise and Hare" example:
// https://en.wikipedia.org/wiki/Mann%E2%80%93Whitney_U_test
//
// Default ranks (from finish order T H H H H H T T T T T H):
// - Tortoises: 1, 7, 8, 9, 10, 11 → sum = 46
// - Hares: 2, 3, 4, 5, 6, 12 → sum = 32
//
// Expected results: R_T=46, R_H=32, U_T=11, U_H=25, U=11
// ============================================================================

const mannWhitneyConfig: Config = {
  formulas: [
    // Step 1: Sum of ranks - R_T shows as symbol (name), t_i shows as values
    {
      id: "r1-sum",
      latex: "{R_T} = {t_1} + {t_2} + {t_3} + {t_4} + {t_5} + {t_6}",
    },
    {
      id: "r2-sum",
      latex: "{R_H} = {h_1} + {h_2} + {h_3} + {h_4} + {h_5} + {h_6}",
    },
    // Step 2: U statistic formulas
    {
      id: "u1-formula",
      latex: "{U_T} = {n_T} \\cdot {n_H} + \\frac{{n_T}({n_T}+1)}{2} - {R_T}",
    },
    {
      id: "u2-formula",
      latex: "{U_H} = {n_T} \\cdot {n_H} + \\frac{{n_H}({n_H}+1)}{2} - {R_H}",
    },
    {
      id: "u-final",
      latex: "{U} = \\min({U_T}, {U_H})",
    },
    // Step 3: Normal approximation
    {
      id: "mu-u",
      latex: "{\\mu_U} = \\frac{{n_T} \\cdot {n_H}}{2}",
    },
    {
      id: "sigma-u",
      latex:
        "{\\sigma_U} = \\sqrt{\\frac{{n_T} \\cdot {n_H} \\cdot ({n_T} + {n_H} + 1)}{12}}",
    },
    {
      id: "z-score",
      latex: "{z} = \\frac{{U} - {\\mu_U}}{{\\sigma_U}}",
    },
    // Inline formulas for prose explanations (no variable binding - just symbols)
    {
      id: "u-formula-inline",
      latex: "U = n_1 \\cdot n_2 + \\frac{n_1(n_1+1)}{2} - R_1",
    },
    {
      id: "z-formula-inline",
      latex: "z = \\frac{U - \\mu_U}{\\sigma_U}",
    },
  ],
  variables: {
    // Tortoise ranks - INPUT variables
    t_1: {
      input: "drag",
      precision: 0,
      default: 1,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    t_2: {
      input: "drag",
      precision: 0,
      default: 7,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    t_3: {
      input: "drag",
      precision: 0,
      default: 8,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    t_4: {
      input: "drag",
      precision: 0,
      default: 9,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    t_5: {
      input: "drag",
      precision: 0,
      default: 10,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    t_6: {
      input: "drag",
      precision: 0,
      default: 11,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    // Hare ranks - INPUT variables
    h_1: {
      input: "drag",
      precision: 0,
      default: 2,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    h_2: {
      input: "drag",
      precision: 0,
      default: 3,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    h_3: {
      input: "drag",
      precision: 0,
      default: 4,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    h_4: {
      input: "drag",
      precision: 0,
      default: 5,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    h_5: {
      input: "drag",
      precision: 0,
      default: 6,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    h_6: {
      input: "drag",
      precision: 0,
      default: 12,
      range: [1, 12],
      step: 1,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    // Sample sizes - CONSTANTS
    n_T: {
      precision: 0,
      default: 6,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    n_H: {
      precision: 0,
      default: 6,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    // Sum of ranks
    R_T: {
      precision: 0,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    R_H: {
      precision: 0,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    // U statistics
    U_T: {
      precision: 0,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    U_H: {
      precision: 0,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    U: {
      precision: 0,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    // Normal approximation parameters
    "\\mu_U": {
      precision: 2,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    "\\sigma_U": {
      precision: 2,
      latexDisplay: "name",
      labelDisplay: "value",
    },
    z: {
      precision: 3,
      latexDisplay: "name",
      labelDisplay: "value",
    },
  },
  semantics: ({ vars }) => {
    // Sum of ranks
    const R_T = vars.t_1 + vars.t_2 + vars.t_3 + vars.t_4 + vars.t_5 + vars.t_6;
    const R_H = vars.h_1 + vars.h_2 + vars.h_3 + vars.h_4 + vars.h_5 + vars.h_6;
    vars.R_T = R_T;
    vars.R_H = R_H;

    const n1 = vars.n_T;
    const n2 = vars.n_H;

    // U statistics
    const U_T = n1 * n2 + (n1 * (n1 + 1)) / 2 - R_T;
    const U_H = n1 * n2 + (n2 * (n2 + 1)) / 2 - R_H;
    vars.U_T = U_T;
    vars.U_H = U_H;
    vars.U = Math.min(U_T, U_H);

    // Normal approximation
    const muU = (n1 * n2) / 2;
    const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    vars["\\mu_U"] = muU;
    vars["\\sigma_U"] = sigmaU;
    vars.z = (vars.U - muU) / sigmaU;
  },
  fontSize: 1.3,
};

export const MannWhitneyExample: React.FC = () => {
  return (
    <Provider config={mannWhitneyConfig}>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold mb-2">The Mann-Whitney U Test</h1>
        <p className="text-xl text-gray-500 mb-8">
          A non-parametric way to compare two groups
        </p>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            Sometimes you want to know if one group tends to outperform another,
            but you can't assume your data follows a normal distribution. That's
            where the <strong>Mann-Whitney U test</strong> comes in. It compares
            two independent samples by looking at their ranks rather than their
            raw values, making it robust to outliers and skewed distributions.
          </p>

          <p className="mb-6">
            To make this concrete, let's look at a classic example: Aesop races{" "}
            <InlineVariable id="n_T" display="value" /> tortoises against{" "}
            <InlineVariable id="n_H" display="value" /> hares. The animals cross
            the finish line in a particular order. One tortoise wins outright,
            but then five hares finish before the rest of the tortoises straggle
            in. Finally, one last hare brings up the rear.
          </p>
        </div>

        {/* Interactive Race Order Visualization */}
        <RaceOrderVisualizationInner />

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            The first step is to assign ranks based on finish position. First
            place gets rank 1, second place gets rank 2, and so on. Then we add
            up the ranks for each group. The tortoise ranks sum to{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-amber-50 px-2 py-0.5 rounded">
              R<sub>T</sub> = <InlineVariable id="R_T" display="value" />
            </span>
            , while the hare ranks sum to{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-amber-50 px-2 py-0.5 rounded">
              R<sub>H</sub> = <InlineVariable id="R_H" display="value" />
            </span>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 my-8">
          <Formula id="r1-sum" style={{ height: "180px" }} />
          <Formula id="r2-sum" style={{ height: "180px" }} />
        </div>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            Now we compute the <strong>U statistic</strong>, which counts how
            many times members of one group beat members of the other. There's a
            neat formula for this that uses the rank sums:{" "}
            <InlineFormula id="u-formula-inline" scale={0.9} />. We calculate U
            for both groups and take the smaller value as our test statistic.
          </p>

          <p className="mb-6">
            For the tortoises, we get{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-green-50 px-2 py-0.5 rounded">
              U<sub>T</sub> = <InlineVariable id="U_T" display="value" />
            </span>
            . For the hares,{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-blue-50 px-2 py-0.5 rounded">
              U<sub>H</sub> = <InlineVariable id="U_H" display="value" />
            </span>
            . The test statistic is the minimum:{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-purple-50 px-2 py-0.5 rounded">
              U = <InlineVariable id="U" display="value" />
            </span>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-8">
          <Formula id="u1-formula" style={{ height: "200px" }} />
          <Formula id="u2-formula" style={{ height: "200px" }} />
        </div>
        <div className="mb-8">
          <Formula id="u-final" style={{ height: "150px" }} />
        </div>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            What does U = <InlineVariable id="U" display="value" /> actually
            mean? We can verify it with the direct method: count how many hares
            each tortoise beats. The first tortoise (rank 1) beats all 6 hares.
            The remaining 5 tortoises (ranks 7-11) each beat only the slowest
            hare (rank 12). That's 6 + 1 + 1 + 1 + 1 + 1 = 11 wins for the
            tortoises.
          </p>

          <p className="mb-6">
            To test whether this result is statistically significant, we use a{" "}
            <strong>normal approximation</strong>. Under the null hypothesis
            that there's no difference between groups, U has a known mean and
            standard deviation. We can convert our U value to a{" "}
            <strong>z-score</strong> to see how extreme it is.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-8">
          <Formula id="mu-u" style={{ height: "180px" }} />
          <Formula id="sigma-u" style={{ height: "180px" }} />
        </div>
        <div className="mb-8">
          <Formula id="z-score" style={{ height: "180px" }} />
        </div>

        <div className="max-w-none text-lg text-gray-700 leading-relaxed">
          <p className="mb-6">
            The expected value of U under the null hypothesis is{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded">
              μ<sub>U</sub> = <InlineVariable id="\mu_U" display="value" />
            </span>
            , with standard deviation{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-gray-100 px-2 py-0.5 rounded">
              σ<sub>U</sub> = <InlineVariable id="\sigma_U" display="value" />
            </span>
            . Our z-score comes out to{" "}
            <span className="inline-flex items-center gap-1 font-mono bg-red-50 px-2 py-0.5 rounded">
              z = <InlineVariable id="z" display="value" />
            </span>
            .
          </p>

          <p className="mb-6">
            A z-score beyond ±1.96 is significant at the 5% level. Beyond ±2.58,
            it's significant at the 1% level. Our z ={" "}
            <InlineVariable id="z" display="value" /> is far beyond these
            thresholds, providing strong evidence that tortoises and hares
            really do differ in racing performance.
          </p>

          <p className="mb-6">
            Try dragging the rank values in the formulas above to explore
            different scenarios. When the ranks become more mixed between
            groups, U increases toward its expected value and z approaches zero,
            indicating no significant difference.
          </p>

          <p className="text-gray-500 text-base mt-10">
            This example is based on the classic "Tortoise and Hare"
            illustration from the Mann-Whitney U test Wikipedia article.
          </p>
        </div>
      </div>
    </Provider>
  );
};

export default MannWhitneyExample;
