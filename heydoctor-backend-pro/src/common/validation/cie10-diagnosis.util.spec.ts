import {
  diagnosisHasLeadingCie10Prefix,
  diagnosisHasValidLeadingCie10IfPresent,
} from './cie10-diagnosis.util';

describe('cie10-diagnosis', () => {
  it('allows empty and free text', () => {
    expect(diagnosisHasValidLeadingCie10IfPresent('')).toBe(true);
    expect(diagnosisHasValidLeadingCie10IfPresent('   ')).toBe(true);
    expect(diagnosisHasValidLeadingCie10IfPresent('Gripe sin código')).toBe(true);
  });

  it('allows valid leading code', () => {
    expect(diagnosisHasValidLeadingCie10IfPresent('A09')).toBe(true);
    expect(diagnosisHasValidLeadingCie10IfPresent('A09.0 Gastroenteritis')).toBe(
      true,
    );
    expect(diagnosisHasLeadingCie10Prefix('A09 - Texto')).toBe(true);
  });

  it('detects leading code prefix', () => {
    expect(diagnosisHasLeadingCie10Prefix('sin código')).toBe(false);
    expect(diagnosisHasLeadingCie10Prefix('A09 foo')).toBe(true);
  });
});
