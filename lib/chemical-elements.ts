import type { Category, CategoryAnswer } from "@/lib/category-types";
import { toStableAnswerId } from "@/lib/normalize";

type ElementRecord = readonly [
  atomicNumber: number,
  symbol: string,
  name: string,
  period: number,
  aliases?: readonly string[],
];

export const chemicalElementRecords: readonly ElementRecord[] = [
  [1, "H", "Hydrogen", 1], [2, "He", "Helium", 1],
  [3, "Li", "Lithium", 2], [4, "Be", "Beryllium", 2], [5, "B", "Boron", 2],
  [6, "C", "Carbon", 2], [7, "N", "Nitrogen", 2], [8, "O", "Oxygen", 2],
  [9, "F", "Fluorine", 2], [10, "Ne", "Neon", 2],
  [11, "Na", "Sodium", 3], [12, "Mg", "Magnesium", 3],
  [13, "Al", "Aluminium", 3, ["Aluminum"]], [14, "Si", "Silicon", 3],
  [15, "P", "Phosphorus", 3], [16, "S", "Sulfur", 3, ["Sulphur"]],
  [17, "Cl", "Chlorine", 3], [18, "Ar", "Argon", 3],
  [19, "K", "Potassium", 4], [20, "Ca", "Calcium", 4],
  [21, "Sc", "Scandium", 4], [22, "Ti", "Titanium", 4],
  [23, "V", "Vanadium", 4], [24, "Cr", "Chromium", 4],
  [25, "Mn", "Manganese", 4], [26, "Fe", "Iron", 4],
  [27, "Co", "Cobalt", 4], [28, "Ni", "Nickel", 4],
  [29, "Cu", "Copper", 4], [30, "Zn", "Zinc", 4],
  [31, "Ga", "Gallium", 4], [32, "Ge", "Germanium", 4],
  [33, "As", "Arsenic", 4], [34, "Se", "Selenium", 4],
  [35, "Br", "Bromine", 4], [36, "Kr", "Krypton", 4],
  [37, "Rb", "Rubidium", 5], [38, "Sr", "Strontium", 5],
  [39, "Y", "Yttrium", 5], [40, "Zr", "Zirconium", 5],
  [41, "Nb", "Niobium", 5], [42, "Mo", "Molybdenum", 5],
  [43, "Tc", "Technetium", 5], [44, "Ru", "Ruthenium", 5],
  [45, "Rh", "Rhodium", 5], [46, "Pd", "Palladium", 5],
  [47, "Ag", "Silver", 5], [48, "Cd", "Cadmium", 5],
  [49, "In", "Indium", 5], [50, "Sn", "Tin", 5],
  [51, "Sb", "Antimony", 5], [52, "Te", "Tellurium", 5],
  [53, "I", "Iodine", 5], [54, "Xe", "Xenon", 5],
  [55, "Cs", "Caesium", 6, ["Cesium"]], [56, "Ba", "Barium", 6],
  [57, "La", "Lanthanum", 6], [58, "Ce", "Cerium", 6],
  [59, "Pr", "Praseodymium", 6], [60, "Nd", "Neodymium", 6],
  [61, "Pm", "Promethium", 6], [62, "Sm", "Samarium", 6],
  [63, "Eu", "Europium", 6], [64, "Gd", "Gadolinium", 6],
  [65, "Tb", "Terbium", 6], [66, "Dy", "Dysprosium", 6],
  [67, "Ho", "Holmium", 6], [68, "Er", "Erbium", 6],
  [69, "Tm", "Thulium", 6], [70, "Yb", "Ytterbium", 6],
  [71, "Lu", "Lutetium", 6], [72, "Hf", "Hafnium", 6],
  [73, "Ta", "Tantalum", 6], [74, "W", "Tungsten", 6, ["Wolfram"]],
  [75, "Re", "Rhenium", 6], [76, "Os", "Osmium", 6],
  [77, "Ir", "Iridium", 6], [78, "Pt", "Platinum", 6],
  [79, "Au", "Gold", 6], [80, "Hg", "Mercury", 6],
  [81, "Tl", "Thallium", 6], [82, "Pb", "Lead", 6],
  [83, "Bi", "Bismuth", 6], [84, "Po", "Polonium", 6],
  [85, "At", "Astatine", 6], [86, "Rn", "Radon", 6],
  [87, "Fr", "Francium", 7], [88, "Ra", "Radium", 7],
  [89, "Ac", "Actinium", 7], [90, "Th", "Thorium", 7],
  [91, "Pa", "Protactinium", 7], [92, "U", "Uranium", 7],
  [93, "Np", "Neptunium", 7], [94, "Pu", "Plutonium", 7],
  [95, "Am", "Americium", 7], [96, "Cm", "Curium", 7],
  [97, "Bk", "Berkelium", 7], [98, "Cf", "Californium", 7],
  [99, "Es", "Einsteinium", 7], [100, "Fm", "Fermium", 7],
  [101, "Md", "Mendelevium", 7], [102, "No", "Nobelium", 7],
  [103, "Lr", "Lawrencium", 7], [104, "Rf", "Rutherfordium", 7],
  [105, "Db", "Dubnium", 7], [106, "Sg", "Seaborgium", 7],
  [107, "Bh", "Bohrium", 7], [108, "Hs", "Hassium", 7],
  [109, "Mt", "Meitnerium", 7], [110, "Ds", "Darmstadtium", 7],
  [111, "Rg", "Roentgenium", 7], [112, "Cn", "Copernicium", 7],
  [113, "Nh", "Nihonium", 7], [114, "Fl", "Flerovium", 7],
  [115, "Mc", "Moscovium", 7], [116, "Lv", "Livermorium", 7],
  [117, "Ts", "Tennessine", 7], [118, "Og", "Oganesson", 7],
] as const;

function buildChemicalElementAnswers(): readonly CategoryAnswer[] {
  return chemicalElementRecords.map(([, symbol, canonicalText, period, aliases]) => ({
    id: `element-${toStableAnswerId(canonicalText)}`,
    canonicalText,
    aliases: [symbol, ...(aliases ?? [])],
    visual: {
      kind: "text" as const,
      label: symbol,
      accessibleLabel: `${symbol}, ${canonicalText} element symbol`,
      primaryColor: "#1463ff",
      secondaryColor: "#dbe6ff",
    },
    groupIds: [`period-${period}`],
  }));
}

export const chemicalElementsCategory: Category = {
  slug: "chemical-elements",
  version: 1,
  snapshotDate: "2022-05-04",
  title: "Chemical elements",
  prompt: "How many chemical elements can you name?",
  timeLimitSeconds: 90,
  inputLabel: "Type a chemical element",
  inputPlaceholder: "Type an element name or symbol…",
  sourceLabel: "IUPAC periodic table · May 4, 2022",
  coverage: {
    title: "Period coverage",
    itemLabel: "Periods",
    groups: Array.from({ length: 7 }, (_, index) => ({
      id: `period-${index + 1}`,
      label: `P${index + 1}`,
    })),
  },
  answers: buildChemicalElementAnswers(),
};

export const practiceCategories = [chemicalElementsCategory] as const;

export function getPracticeCategory(slug: string): Category | null {
  return practiceCategories.find((category) => category.slug === slug) ?? null;
}
