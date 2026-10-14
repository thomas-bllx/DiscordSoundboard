import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="fatal">
          <h1>L’interface a rencontré un problème.</h1>
          <p>
            Fermez l’application depuis son icône dans la zone de notification,
            puis relancez-la. Votre bibliothèque est conservée.
          </p>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
