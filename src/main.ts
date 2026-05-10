import * as d3 from "d3";

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
