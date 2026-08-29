// Las categorias son filas creadas por el usuario (categories.name), no un
// enum fijo -- por eso el color se deriva del nombre en vez de venir de una
// tabla de colores hardcodeada. Mismo nombre siempre produce el mismo color.
const PALETTE = [
  "#E8A87C",
  "#85C1E9",
  "#C39BD3",
  "#82E0AA",
  "#F1948A",
  "#F7DC6F",
  "#A9CCE3",
  "#7FB3A3",
  "#D7A9E8",
  "#E8C07C",
];

export function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
