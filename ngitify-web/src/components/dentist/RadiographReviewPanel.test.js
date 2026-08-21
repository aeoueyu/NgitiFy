import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RadiographReviewPanel, { toNormalizedImagePoint } from './RadiographReviewPanel';
import { authFetch } from '../../utils/api';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn() }));

const radiograph = {
    id: 'rad-1',
    type: 'Periapical',
    label: 'Periapical',
    date: '2026-08-20T00:00:00.000Z',
    url: 'data:image/png;base64,aW1hZ2U=',
    analysis: {
        status: 'ready',
        qualityAssessment: { label: 'Acceptable', issues: [] },
        detections: [{ id: 'd-1', predictedToothNumber: '46', status: 'pending', geometry: { x: .2, y: .3, width: .1, height: .1 } }],
    },
    annotations: [],
    reviewSummary: { status: 'none' },
};

const renderPanel = (overrides = {}) => render(
    <RadiographReviewPanel
        patientId="patient-1"
        radiograph={radiograph}
        onChange={jest.fn()}
        onClose={jest.fn()}
        onEnhance={jest.fn().mockResolvedValue(true)}
        {...overrides}
    />,
);

test('does not render AI visual detections or a Show AI control', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: /show ai/i })).toBeNull();
    expect(screen.queryByLabelText(/ai suggestion/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Teeth' })).toBeNull();
});

test('uses compact NgitiFy badges and pill selectors without pill-styling clinical notes', () => {
    renderPanel();
    expect(screen.getByText('Review Pending').className).toContain('reviewStatusPending');
    expect(screen.getByText('Acceptable').className).toContain('statusBadge');

    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));
    expect(screen.getByRole('combobox', { name: 'FDI Tooth' }).closest('label').className).toContain('pillField');
    expect(screen.getByRole('combobox', { name: 'Related Treatment' }).closest('label').className).toContain('pillField');
    expect(screen.getByRole('textbox', { name: 'Clinical note' }).className).not.toContain('pillField');
});

test('renders successful request feedback as a status badge', async () => {
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Saved.' }) });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /run analysis again/i }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Saved.');
    expect(status.className).toContain('successMessage');
});

test('normalizes annotation coordinates against the displayed image bounds', () => {
    expect(toNormalizedImagePoint(
        { clientX: 500, clientY: 250 },
        { left: 100, top: 50, width: 800, height: 400 },
    )).toEqual({ type: 'point', x: .5, y: .5, width: 0, height: 0 });

    expect(toNormalizedImagePoint(
        { clientX: 250, clientY: 175 },
        { left: 50, top: 75, width: 400, height: 200 },
    )).toEqual({ type: 'point', x: .5, y: .5, width: 0, height: 0 });
});

test('places the marker at the clicked position in fit and zoomed image bounds', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }));
    const image = screen.getByRole('img', { name: 'Periapical' });
    image.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 400, right: 900, bottom: 450 });
    fireEvent.click(image, { clientX: 300, clientY: 150 });
    const marker = screen.getByLabelText('New annotation point');
    expect(marker.style.left).toBe('25%');
    expect(marker.style.top).toBe('25%');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }));
    image.getBoundingClientRect = () => ({ left: 50, top: 25, width: 1000, height: 500, right: 1050, bottom: 525 });
    fireEvent.click(image, { clientX: 550, clientY: 275 });
    expect(screen.getByLabelText('New annotation point').style.left).toBe('50%');
    expect(screen.getByLabelText('New annotation point').style.top).toBe('50%');

    fireEvent.click(screen.getByRole('button', { name: /fit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }));
    image.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 400, right: 900, bottom: 450 });
    fireEvent.click(image, { clientX: 700, clientY: 350 });
    expect(screen.getByLabelText('New annotation point').style.left).toBe('75%');
    expect(screen.getByLabelText('New annotation point').style.top).toBe('75%');
});

test('Auto Improve disables during one in-flight request and restores afterward', async () => {
    let finish;
    const onEnhance = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    renderPanel({ onEnhance });
    const button = screen.getByRole('button', { name: /auto improve/i });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(onEnhance).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /improving/i }).disabled).toBe(true);
    finish(true);
    await waitFor(() => expect(screen.getByRole('button', { name: /auto improve/i }).disabled).toBe(false));
});

test('Auto Improve reports a recoverable error and restores the action', async () => {
    renderPanel({ onEnhance: jest.fn().mockRejectedValue(new Error('Enhancement service unavailable')) });
    fireEvent.click(screen.getByRole('button', { name: /auto improve/i }));
    expect((await screen.findByRole('status')).textContent).toContain('Enhancement service unavailable');
    expect(screen.getByRole('button', { name: /auto improve/i }).disabled).toBe(false);
});
