import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import Menu from "./Menu";
import Playground from "./playground/Playground";

function App() {
  return (
    <div className="relative min-h-screen">
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/playground/:exampleId" element={<Playground />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
