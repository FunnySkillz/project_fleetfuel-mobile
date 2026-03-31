import { describe, expect, it } from 'vitest';

import { kwFromPs, psFromKw } from '@/utils/vehicle-power';

describe('vehicle power conversion', () => {
  it('converts kW to PS using rounded value', () => {
    expect(psFromKw(110)).toBe(150);
    expect(psFromKw(55)).toBe(75);
  });

  it('converts PS to kW using rounded value', () => {
    expect(kwFromPs(150)).toBe(110);
    expect(kwFromPs(75)).toBe(55);
  });
});

