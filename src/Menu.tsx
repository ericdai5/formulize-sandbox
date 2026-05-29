import { Link } from "react-router-dom";
import { EXAMPLES } from "./examples";

export default function Menu() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900">
            Formulize Sandbox
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Pick an example to open it in the playground. Each example launches
            inside an editable E2B sandbox.
          </p>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAMPLES.map((example) => (
            <li key={example.id}>
              <Link
                to={`/playground/${example.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">
                  {example.label}
                </div>
                {example.description && (
                  <div className="mt-1 text-xs text-gray-500">
                    {example.description}
                  </div>
                )}
                <div className="mt-3 text-[11px] text-gray-400 font-mono">
                  /playground/{example.id}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
