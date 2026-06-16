import * as d3 from "d3";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  OFF_WORLD_X,
  OFF_WORLD_Y,
  ERA_PALETTE,
  MAX_SEASON,
} from "../config.js";
import { getState, subscribe, selectOnlyDungeon } from "../state.js";
import type { DungeonManifest, DungeonMeta } from "../types.js";

const CLUSTER_RADIUS = 40;

let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
let nodesG: d3.Selection<SVGGElement, unknown, null, undefined>;
let manifest: DungeonManifest;
let activeDungeons: DungeonMeta[] = [];
let positionMap = new Map<number, { x: number; y: number }>();

function buildPositions(): void {
  positionMap = new Map();
  const zoneBySlug = new Map(manifest.zones.map((z) => [z.slug, z]));

  const byZone = new Map<string, DungeonMeta[]>();
  for (const d of activeDungeons) {
    if (d.offWorld) continue;
    const arr = byZone.get(d.zone) ?? [];
    arr.push(d);
    byZone.set(d.zone, arr);
  }

  for (const [slug, dungeons] of byZone) {
    const zone = zoneBySlug.get(slug);
    if (!zone) continue;
    if (dungeons.length === 1) {
      positionMap.set(dungeons[0].id, { x: zone.x, y: zone.y });
    } else {
      dungeons.forEach((d, i) => {
        const angle = (2 * Math.PI * i) / dungeons.length - Math.PI / 2;
        positionMap.set(d.id, {
          x: zone.x + CLUSTER_RADIUS * Math.cos(angle),
          y: zone.y + CLUSTER_RADIUS * Math.sin(angle),
        });
      });
    }
  }

  const offWorld = activeDungeons.filter((d) => d.offWorld);
  const half = Math.floor(offWorld.length / 2);
  offWorld.forEach((d, i) => {
    positionMap.set(d.id, { x: OFF_WORLD_X + (i - half) * 60, y: OFF_WORLD_Y });
  });
}

export function initMap(container: HTMLElement, mf: DungeonManifest): void {
  manifest = mf;
  const validDungeonIds = new Set(
    mf.seasons
      .filter(s => s.id <= MAX_SEASON && s.dungeonIds.length > 0)
      .flatMap(s => s.dungeonIds)
  );
  activeDungeons = mf.dungeons.filter(d => validDungeonIds.has(d.id));
  buildPositions();

  svg = d3
    .select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("display", "block");

  const root = svg.append("g").attr("class", "zoom-root");

  root
    .append("image")
    .attr("href", "/map.jpg")
    .attr("width", MAP_WIDTH)
    .attr("height", MAP_HEIGHT)
    .attr("preserveAspectRatio", "xMidYMid slice");

  root
    .append("text")
    .attr("x", OFF_WORLD_X)
    .attr("y", OFF_WORLD_Y - 100)
    .attr("text-anchor", "middle")
    .attr("fill", "#583c15ff")
    .attr("stroke", "#e3cba4ff")
    .attr("stroke-width", 4)
    .attr("font-size", 128)
    .attr("font-weight", "bold")
    .text("Off-World");

  nodesG = root.append("g").attr("class", "nodes");

  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 5])
      .on("zoom", (event) => root.attr("transform", event.transform)),
  );

  subscribe(renderNodes);
}

function renderNodes(): void {
  if (!nodesG) return;
  const state = getState();

  const nodes = nodesG
    .selectAll<SVGCircleElement, DungeonMeta>("circle")
    .data(activeDungeons, (d) => d.id);

  nodes
    .enter()
    .append("circle")
    .attr("cx", (d) => positionMap.get(d.id)?.x ?? 0)
    .attr("cy", (d) => positionMap.get(d.id)?.y ?? 0)
    .attr("r", 14)
    .attr("stroke-width", 2)
    .style("cursor", "pointer")
    .on("click", (_event, d) => selectOnlyDungeon(d.id))
    .merge(nodes)
    .transition()
    .duration(300)
    .attr("fill", (d) => ERA_PALETTE[d.era])
    .attr("stroke", (d) =>
      state.selectedDungeons.includes(d.id) ? "#ffffff" : "rgba(0,0,0,0.4)",
    )
    .attr("opacity", (d) =>
      state.selectedDungeons.length > 0 && !state.selectedDungeons.includes(d.id) ? 0.5 : 1
    );

  nodes.exit().remove();
}
