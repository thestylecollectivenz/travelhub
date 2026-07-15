import {
  defaultLocationInfoNotes,
  ensureUniqueHighlightIds,
  locationHighlightRows,
  mergeAIResult,
  mergeLocationInfoNotes,
  recordSuppressedHighlightLabels,
  type LocationInfoAIResult
} from './locationInfoEntry';

describe('locationInfo merge preserves user content', () => {
  const aiPayload: LocationInfoAIResult = {
    overview: 'AI overview text',
    practicalTips: 'AI practical tips',
    sights: [{ label: 'New sight from AI', done: false }],
    food: [{ label: 'Local dish', done: false }],
    drink: [{ label: 'Local beer', done: false }],
    souvenirs: [{ label: 'Wool sweater', done: false }]
  };

  it('does not overwrite user-edited overview or practical tips', () => {
    const existing = {
      ...defaultLocationInfoNotes('place-1'),
      overview: 'My custom overview',
      practicalTips: 'My tips',
      userEditedOverview: true,
      userEditedPracticalTips: true
    };
    const merged = mergeAIResult(existing, aiPayload);
    expect(merged.overview).toBe('My custom overview');
    expect(merged.practicalTips).toBe('My tips');
  });

  it('keeps checked state and manual extras when merging highlights', () => {
    const existing = {
      ...defaultLocationInfoNotes('place-1'),
      iconicSightsItems: [
        { id: 'a', label: 'Harbour walk', done: true, source: 'user' as const },
        { id: 'b', label: 'Manual only', done: false, source: 'user' as const }
      ]
    };
    const merged = mergeAIResult(existing, aiPayload);
    const rows = locationHighlightRows(merged);
    const harbour = rows.find((r) => r.label === 'Harbour walk');
    const manual = rows.find((r) => r.label === 'Manual only');
    const aiSight = rows.find((r) => r.label === 'New sight from AI');
    expect(harbour?.done).toBe(true);
    expect(manual).toBeTruthy();
    expect(aiSight).toBeTruthy();
  });

  it('does not re-add suppressed highlight labels', () => {
    const existing = {
      ...defaultLocationInfoNotes('place-1'),
      suppressedHighlightKeys: ['tourist trap']
    };
    const payload: LocationInfoAIResult = {
      ...aiPayload,
      sights: [{ label: 'Tourist trap', done: false }]
    };
    const merged = mergeAIResult(existing, payload);
    expect(locationHighlightRows(merged).some((r) => r.label.toLowerCase() === 'tourist trap')).toBe(false);
  });

  it('records deleted labels as suppressed', () => {
    const data = defaultLocationInfoNotes('place-1');
    const prev = locationHighlightRows({
      ...data,
      iconicSightsItems: [{ id: '1', label: 'Removed item', done: false }]
    });
    const next = locationHighlightRows(data);
    const keys = recordSuppressedHighlightLabels(data, prev, next);
    expect(keys).toContain('removed item');
  });

  it('assigns unique highlight ids per category', () => {
    const data = ensureUniqueHighlightIds({
      ...defaultLocationInfoNotes('place-1'),
      iconicSightsItems: [{ id: 'item-0-Marketvisit', label: 'Market', done: false }],
      foodDrinkItems: [{ id: 'item-0-Marketvisit', label: 'Market food', done: false }]
    });
    const rows = locationHighlightRows(data);
    const sight = rows.find((r) => r.kind === 'sight');
    const food = rows.find((r) => r.kind === 'food');
    expect(sight?.id).not.toBe(food?.id);
    expect(sight?.id.startsWith('sight-')).toBe(true);
    expect(food?.id.startsWith('food-')).toBe(true);
  });

  it('merges Q&A and saved places across duplicate day cards', () => {
    const a = {
      ...defaultLocationInfoNotes('place-1'),
      overview: 'City overview',
      diningSuggestions: [{ id: 'd1', name: 'Cafe One' }],
      aiQaThread: [{ id: 'q1', question: 'Best park?', answer: 'Central Park', createdAt: '2026-01-01T00:00:00.000Z' }]
    };
    const b = {
      ...defaultLocationInfoNotes('place-1'),
      practicalTips: 'Carry cash',
      diningSuggestions: [{ id: 'd2', name: 'Cafe Two' }],
      aiQaThread: [{ id: 'q2', question: 'ATM nearby?', answer: 'Yes on Main St', createdAt: '2026-01-02T00:00:00.000Z' }]
    };
    const merged = mergeLocationInfoNotes(a, b);
    expect(merged.overview).toBe('City overview');
    expect(merged.practicalTips).toBe('Carry cash');
    expect(merged.diningSuggestions?.map((x) => x.name).sort()).toEqual(['Cafe One', 'Cafe Two']);
    expect(merged.aiQaThread?.map((x) => x.id)).toEqual(['q1', 'q2']);
  });
});
