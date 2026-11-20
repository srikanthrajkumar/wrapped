// The Item editor's words (docs/design/item-editor.md §4-§6): the Undo bar's names for a removed
// piece, a part's Ragas as text, the Tala's nadai, and the Tala's text with a Nadai it can't name.

import { describe, expect, it } from 'vitest';
import { catalogValue, notApplicableValue, unknownValue } from '../../src/model';
import type { DeletionReceipt, RemovedPiece } from '../../src/store/receipts';
import { talaText } from '../../src/screens/format';
import { nadaiName, partRagasText, talaNadaiName, valueLine } from '../../src/screens/item-words';
import { undoMessage } from '../../src/screens/undo';

const receipt = (piece: RemovedPiece): DeletionReceipt => ({
  id: 'r1',
  kind: 'piece',
  eventId: 'e1',
  position: 3,
  records: [{ table: 'items', id: 'i1', deletedAt: null }],
  piece,
  at: '2026-12-14T14:00:00.000Z',
});

const kalyani = catalogValue('kalyani', 'Kalyani');

describe('the Undo bar names a removed piece (§6)', () => {
  it.each([
    [{ field: 'ragas', index: 1, value: kalyani }, 'Raga removed'],
    [{ field: 'improvised', kind: 'kalpana_swaram', value: [] }, 'Kalpanaswaram removed'],
    [{ field: 'improvised', kind: 'alapana', value: [] }, 'Alapana removed'],
    [{ field: 'nadais', index: 0, value: kalyani }, 'Nadai removed'],
    [{ field: 'layaVinyasam', value: { nadais: [], note: null } }, 'Layavinyasam removed'],
    [{ field: 'partRagas', kind: 'tanam', index: 0, before: [kalyani], after: [] }, 'Raga removed'],
    [
      { field: 'partRagas', kind: 'tanam', index: null, before: [kalyani], after: [] },
      'Ragas removed',
    ],
  ] as [RemovedPiece, string][])('%j reads "%s"', (piece, message) => {
    expect(undoMessage(receipt(piece))).toBe(message);
  });
});

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
