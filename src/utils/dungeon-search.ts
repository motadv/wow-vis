export function matchesDungeonSearch(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}
