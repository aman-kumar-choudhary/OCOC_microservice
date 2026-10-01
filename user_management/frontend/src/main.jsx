import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import App from "./App";
import "./style.css";
import "./auth.css";

const container =
  document.getElementById("root") || document.getElementById("app");
if (!container) {
  throw new Error("Root container not found in DOM");
}
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
