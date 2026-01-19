import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

try {
    createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
    console.error("Critical Application Error:", e);
    document.body.innerHTML = `<div style="padding: 20px; color: red;"><h1>Application Error</h1><pre>${e instanceof Error ? e.message + "\n" + e.stack : String(e)}</pre></div>`;
}
