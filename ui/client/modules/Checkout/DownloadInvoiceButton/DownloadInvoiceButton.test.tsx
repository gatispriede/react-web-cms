// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import DownloadInvoiceButton from './DownloadInvoiceButton';
import {EItemType} from '@enums/EItemType';

describe('DownloadInvoiceButton', () => {
    it('renders', () => {
        render(<DownloadInvoiceButton item={{type: EItemType.DownloadInvoiceButton, content: ''}} />);
        expect(screen.getByTestId('module-download-invoice-button')).toBeInTheDocument();
    });
});
