const PS_PER_KW = 1.35962;

export function psFromKw(kw: number) {
  return Math.round(kw * PS_PER_KW);
}

export function kwFromPs(ps: number) {
  return Math.round(ps / PS_PER_KW);
}

