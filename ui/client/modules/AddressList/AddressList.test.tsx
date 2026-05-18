// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import AddressList from './AddressList';
import type {AddressListAddress} from './AddressList.types';

const addresses: AddressListAddress[] = [
    {id: 'a1', name: 'Ada Lovelace', line1: '12 Babbage Way', city: 'London', postalCode: 'W1 1AA', country: 'UK', isDefault: true, label: 'Home'},
    {id: 'a2', name: 'Grace Hopper', line1: '5 Compiler St', line2: 'Suite 9', city: 'New York', region: 'NY', postalCode: '10001', country: 'USA', phone: '+1-555-0100', label: 'Work'},
    {id: 'a3', name: 'Alan Turing', line1: '7 Enigma Rd', city: 'Manchester', postalCode: 'M1 2BB', country: 'UK'},
];

const noop = () => {};

describe('AddressList', () => {
    it('renders empty state with default title', () => {
        render(<AddressList testId="al" addresses={[]} onAdd={noop} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('al-empty')).toBeInTheDocument();
        expect(screen.getByTestId('al-empty-title')).toHaveTextContent('No saved addresses');
    });

    it('add button fires onAdd', () => {
        const onAdd = vi.fn();
        render(<AddressList testId="al" addresses={addresses} onAdd={onAdd} onEdit={noop} onDelete={noop} />);
        fireEvent.click(screen.getByTestId('al-add'));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('renders each card with name and full address parts', () => {
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={noop} onDelete={noop} />);
        const card = screen.getByTestId('al-card-a2');
        expect(card).toHaveTextContent('Grace Hopper');
        expect(card).toHaveTextContent('5 Compiler St');
        expect(card).toHaveTextContent('Suite 9');
        expect(card).toHaveTextContent('10001');
        expect(card).toHaveTextContent('New York');
        expect(card).toHaveTextContent('NY');
        expect(card).toHaveTextContent('USA');
        expect(card).toHaveTextContent('+1-555-0100');
    });

    it('default pill only shows on isDefault rows', () => {
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={noop} onDelete={noop} onSetDefault={noop} />);
        expect(screen.getByTestId('al-default-a1')).toBeInTheDocument();
        expect(screen.queryByTestId('al-default-a2')).toBeNull();
    });

    it('set-default hides on default row and shows on others when callback provided', () => {
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={noop} onDelete={noop} onSetDefault={noop} />);
        expect(screen.queryByTestId('al-set-default-a1')).toBeNull();
        expect(screen.getByTestId('al-set-default-a2')).toBeInTheDocument();
        expect(screen.getByTestId('al-set-default-a3')).toBeInTheDocument();
    });

    it('clicking set-default fires onSetDefault with id', () => {
        const onSetDefault = vi.fn();
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={noop} onDelete={noop} onSetDefault={onSetDefault} />);
        fireEvent.click(screen.getByTestId('al-set-default-a2'));
        expect(onSetDefault).toHaveBeenCalledWith('a2');
    });

    it('edit and delete fire with correct ids', () => {
        const onEdit = vi.fn();
        const onDelete = vi.fn();
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={onEdit} onDelete={onDelete} />);
        fireEvent.click(screen.getByTestId('al-edit-a1'));
        fireEvent.click(screen.getByTestId('al-delete-a3'));
        expect(onEdit).toHaveBeenCalledWith('a1');
        expect(onDelete).toHaveBeenCalledWith('a3');
    });

    it('hides set-default entirely when onSetDefault not provided', () => {
        render(<AddressList testId="al" addresses={addresses} onAdd={noop} onEdit={noop} onDelete={noop} />);
        expect(screen.queryByTestId('al-set-default-a2')).toBeNull();
        expect(screen.queryByTestId('al-set-default-a3')).toBeNull();
    });
});
