import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnotationActionPill } from '../TextAnnotationEditor.jsx';

function makeMap() {
  return {
    project: ([lng, lat]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 }),
    on: vi.fn(), off: vi.fn(), getCanvas: () => ({ style: {} })
  };
}

function makeDraw(feature) {
  return {
    current: {
      get: vi.fn((id) => id === feature.id ? feature : null),
      add: vi.fn(),
      setFeatureProperty: vi.fn(),
      delete: vi.fn()
    }
  };
}

describe('AnnotationActionPill', () => {
  const origPrompt = window.prompt;
  beforeEach(() => { window.prompt = vi.fn(() => 'New Label'); });
  afterEach(() => { window.prompt = origPrompt; });

  it('sets label via prompt and calls onClose', () => {
    const map = makeMap();
    const feature = { id: 'a1', properties: { label: '' }, geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] } };
    const drawRef = makeDraw(feature);
    const onClose = vi.fn();
    render(<AnnotationActionPill map={map} drawRef={drawRef} featureId="a1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Label'));
    expect(onClose).toHaveBeenCalled();
  });

  it('removes feature on ✕ and calls onClose', () => {
    const map = makeMap();
    const feature = { id: 'a2', properties: {}, geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] } };
    const drawRef = makeDraw(feature);
    const onClose = vi.fn();
    render(<AnnotationActionPill map={map} drawRef={drawRef} featureId="a2" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Remove'));
    expect(onClose).toHaveBeenCalled();
  });
});
