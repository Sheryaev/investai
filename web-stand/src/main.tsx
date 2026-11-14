import React from "react";
import ReactDOM from "react-dom/client";
import { StandApp } from "./StandApp";
import "./tokens.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><StandApp /></React.StrictMode>,
);
