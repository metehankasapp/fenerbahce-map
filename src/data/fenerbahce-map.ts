import mapData from "./fenerbahce-map.json";

export type Category =
  | "root"
  | "management"
  | "coaches"
  | "players"
  | "countries"
  | "branches"
  | "stands"
  | "social"
  | "scout"
  | "nostalgia"
  | "media"
  | "micro";

export type MapNode = {
  id: string;
  label: string;
  parent?: string;
  importance: 1 | 2 | 3 | 4 | 5;
  category: Category;
  description: string;
};

type TreeNode = {
  id: string;
  label: string;
  importance: MapNode["importance"];
  category?: Category;
  description?: string;
  children?: TreeNode[];
};

export const categoryLabels: Record<Category, string> = {
  root: "Merkez",
  management: "Başkanlık & Yönetim",
  coaches: "Teknik Direktörler",
  players: "Futbolcu & Efsaneler",
  countries: "Ülke & Transfer",
  branches: "Branşlar",
  stands: "Tribün",
  social: "Twitter Kültürü",
  scout: "Scout & Taktik",
  nostalgia: "Nostalji",
  media: "Medya & Edit",
  micro: "Mikro Camialar",
};

function flattenTree(node: TreeNode, parent?: string, inheritedCategory?: Category): MapNode[] {
  const { children = [], ...current } = node;
  const category = current.category ?? inheritedCategory;

  if (!category) throw new Error(`Missing category for map node: ${node.id}`);

  const normalized: MapNode = {
    ...current,
    category,
    description: current.description ?? `${node.label} camiası.`,
    ...(parent ? { parent } : {}),
  };

  return [
    normalized,
    ...children.flatMap((child) => flattenTree(child, node.id, category)),
  ];
}

export const mapNodes = [
  ...flattenTree(mapData.root as TreeNode),
  ...mapData.floating.flatMap((node) => flattenTree(node as TreeNode)),
];

const treeLinks = mapNodes.flatMap((node) =>
  node.parent ? [{ source: node.parent, target: node.id }] : [],
);

export const mapLinks = [
  ...treeLinks,
  ...mapData.links,
];
