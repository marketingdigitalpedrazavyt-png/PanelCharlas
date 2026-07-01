import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Inscripcion from "./pages/Inscripcion.jsx";
import Panel from "./pages/Panel.jsx";
import Escaner from "./pages/Escaner.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inscripcion />} />
        <Route path="/panel" element={<Panel />} />
        <Route path="/escaner" element={<Escaner />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
