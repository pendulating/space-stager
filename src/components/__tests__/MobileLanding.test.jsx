import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import MobileLanding from '../MobileLanding.jsx';

describe('MobileLanding', () => {
  it('renders message and recommendation', () => {
    render(<MobileLanding />);
    expect(screen.getByText("Space Stager isn’t available on mobile")).toBeInTheDocument();
    expect(screen.getByText('Recommended: screens at least 768px wide (iPad or larger).')).toBeInTheDocument();
  });
});


