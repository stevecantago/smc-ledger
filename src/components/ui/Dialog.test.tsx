import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog accessible markup', () => {
  it('renders a labelled native dialog and its content', () => {
    const markup = renderToStaticMarkup(
      <Dialog open={false} onClose={() => undefined} titleId="ledger-dialog-title">
        <h2 id="ledger-dialog-title">Log transaction</h2>
      </Dialog>,
    );

    expect(markup).toContain('<dialog');
    expect(markup).toContain('aria-labelledby="ledger-dialog-title"');
    expect(markup).toContain('Log transaction');
  });
});
