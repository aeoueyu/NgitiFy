import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RowsPerPageInput from './RowsPerPageInput';

function TestInput() {
    const [value, setValue] = useState(10);

    return (
        <RowsPerPageInput
            value={value}
            onChange={(event) => setValue(Number(event.target.value))}
        />
    );
}

test('allows the current rows-per-page value to be fully cleared while editing', () => {
    render(<TestInput />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
});

test('accepts any positive whole number and restores the last valid value when left blank', () => {
    render(<TestInput />);
    const input = screen.getByRole('spinbutton');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);
    expect(input.value).toBe('3');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('3');
});
