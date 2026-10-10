/** Single source of truth for anchors, nav labels and the section index. */
export type SectionRef = {
  id: string;
  label: string;
  /** Shown in the index overlay: what the section actually proves. */
  note: string;
  /** Present in the condensed desktop nav. */
  primary?: boolean;
};

export const SECTIONS: SectionRef[] = [
  {
    id: "overview",
    label: "The mesh",
    note: "Three robots broadcasting state. Cut one radio and watch the rest fail safe.",
    primary: true,
  },
  {
    id: "clocks",
    label: "Clocks",
    note: "Ordering events across machines with no synchronised wall clock.",
    primary: true,
  },
  {
    id: "mutex",
    label: "Mutual exclusion",
    note: "Two robots, one intersection, no central traffic controller.",
    primary: true,
  },
  {
    id: "tasks",
    label: "Task handover",
    note: "A robot drops out. Its work is re-bid and reassigned in four messages.",
    primary: true,
  },
  {
    id: "failsafe",
    label: "Fail-safe",
    note: "The stop path does not run on the CPU. Crash the software and check.",
    primary: true,
  },
  {
    id: "cloud",
    label: "Cloud layer",
    note: "Passive by construction. Pull the internet and nothing on the floor changes.",
  },
  {
    id: "proven",
    label: "Proven beats custom",
    note: "Five problems, the naive answer, and the published algorithm we used instead.",
  },
  {
    id: "limits",
    label: "Where it fails",
    note: "Six limitations we can name, measure, and tell you the fix for.",
  },
];

export const PRIMARY_SECTIONS = SECTIONS.filter((s) => s.primary);
