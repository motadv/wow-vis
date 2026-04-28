import * as d3 from "d3";
import initDB from "./db/init";
import initViz from "./charts/init";

/**
 * Initialize the project, including database and visualization setup.
 * This function is called at the start of the application to set up necessary components.
 */
async function init() {
  // Initialize project

  // Initialize database
  await initDB();

  // Initialize visualization
  await initViz();
}

async function main() {
  const width = 800;
  const height = 600;

  const svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "#f4f4f4");

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text("D3 + Vite + TS funcionando!")
    .style("font-family", "sans-serif");
}

main();
