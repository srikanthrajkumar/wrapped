// The Item editor's words (docs/design/item-editor.md §4-§6): a part's Ragas as text, the Tala's nadai, and the Tala's text with a Nadai it can't name.

import { describe, expect, it } from 'vitest';
import { catalogValue, notApplicableValue, unknownValue } from '../../src/model';
import { talaText } from '../../src/screens/format';
import { nadaiName, partRagasText, talaNadaiName, valueLine } from '../../src/screens/item-words';

const kalyani = catalogValue('kalyani', 'Kalyani');

describe('the words of Manodharma and the Layavinyasam', () => {
  it('reads a part’s Ragas, its Item’s-Raga slots as the Item’s Raga now', () => {
    const part = { kind: 'alapana' as const, ragas: [null, { ...kalyani, guess: true }] };
    expect(partRagasText(part, catalogValue('kanada', 'Kanada'))).toBe('Kanada, Kalyani (?)');
    expect(partRagasText(part, null)).toBe('?, Kalyani (?)');
    expect(valueLine(notApplicableValue())).toBe('Not applicable');
  });

  it('names the Tala’s nadai: chatusra by default, none for a Tala not known', () => {
    const adi = catalogValue('adi', 'Adi');
    expect(talaNadaiName(adi, notApplicableValue())).toBe('Chatusra');
    expect(talaNadaiName(adi, catalogValue('khanda', 'khanda'))).toBe('Khanda');
    expect(talaNadaiName(adi, unknownValue())).toBeNull();
    expect(talaNadaiName(unknownValue(), notApplicableValue())).toBeNull();
    expect(talaNadaiName(notApplicableValue(), notApplicableValue())).toBeNull();
    expect(nadaiName('sankeerna')).toBe('Sankeerna');
  });

  it('leaves a Nadai it can’t name out of a Tala it can’t name (§6)', () => {
    expect(talaText({ tala: unknownValue(), nadai: unknownValue() })).toBe('?');
    expect(talaText({ tala: catalogValue('adi', 'Adi'), nadai: unknownValue() })).toBe(
      'Adi (? nadai)',
    );
    expect(
      talaText({ tala: catalogValue('adi', 'Adi'), nadai: catalogValue('khanda', 'khanda') }),
    ).toBe('Adi (khanda nadai)');
  });
});
