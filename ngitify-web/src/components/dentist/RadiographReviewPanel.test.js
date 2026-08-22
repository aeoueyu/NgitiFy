import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RadiographReviewPanel, { toNormalizedImagePoint } from './RadiographReviewPanel';
import { authFetch } from '../../utils/api';

jest.mock('../../utils/api', () => ({ authFetch: jest.fn() }));

afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
});

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

test('shows Required and invalid styling when a new finding lacks required fields', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save dentist finding' }));

    const findingInput = screen.getByRole('textbox', { name: 'Finding recorded by dentist' });
    expect(findingInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.getByText('Annotation location').parentElement.textContent).toContain('Required');
    expect(screen.getByLabelText('Periapical viewer').getAttribute('data-location-invalid')).toBe('true');
    expect(authFetch).not.toHaveBeenCalled();
});

test('validates required and oversized values while editing a dentist finding', () => {
    const managedRadiograph = {
        ...radiograph,
        annotations: [{ id: 'finding-1', toothNumber: '46', findingType: 'Existing restoration', note: '', status: 'active', geometry: { type: 'point', x: .4, y: .5, width: 0, height: 0 } }],
    };
    renderPanel({ radiograph: managedRadiograph });
    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Tooth 46' }));
    const editInput = screen.getByRole('textbox', { name: 'Edit finding' });

    fireEvent.change(editInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(editInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(authFetch).not.toHaveBeenCalled();

    fireEvent.change(editInput, { target: { value: 'x'.repeat(161) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert').textContent).toBe('Must be 160 characters or fewer');
    expect(authFetch).not.toHaveBeenCalled();
});

test('edits and archives an active dentist finding through scoped endpoints', async () => {
    const managedRadiograph = {
        ...radiograph,
        annotations: [{ id: 'finding-1', toothNumber: '46', findingType: 'Existing restoration', note: 'Review margin.', linkToOdontogram: true, treatmentLogId: '', status: 'active', geometry: { type: 'point', x: .4, y: .5, width: 0, height: 0 } }],
    };
    authFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Dentist finding updated.', radiograph: managedRadiograph }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Dentist finding archived.', radiograph: managedRadiograph }) });
    renderPanel({ radiograph: managedRadiograph });
    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Tooth 46' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit finding' }), { target: { value: 'Updated restoration' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit clinical note' }), { target: { value: 'Updated clinical note.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
        '/patients/patient-1/radiographs/rad-1/annotations/finding-1',
        expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('Updated restoration') })
    ));

    fireEvent.click(await screen.findByRole('button', { name: 'Archive Tooth 46' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
        '/patients/patient-1/radiographs/rad-1/annotations/finding-1/archive',
        expect.objectContaining({ method: 'POST' })
    ));
});

test('restores archived findings and keeps deleted findings out of the review UI', async () => {
    const managedRadiograph = {
        ...radiograph,
        annotations: [
            { id: 'archived-1', toothNumber: '47', findingType: 'Archived observation', status: 'archived', geometry: { type: 'point', x: .3, y: .4, width: 0, height: 0 } },
            { id: 'deleted-1', toothNumber: '48', findingType: 'Deleted observation', status: 'deleted', geometry: { type: 'point', x: .6, y: .4, width: 0, height: 0 } },
        ],
    };
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Dentist finding restored.', radiograph: managedRadiograph }) });
    renderPanel({ radiograph: managedRadiograph });
    expect(screen.queryByRole('button', { name: /Tooth 47: Archived observation/ })).toBeNull();
    expect(screen.queryByText('Deleted observation')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show archived findings (1)' }));
    expect(screen.getByText('Archived observation')).not.toBeNull();
    expect(screen.queryByText('Deleted observation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Tooth 47' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
        '/patients/patient-1/radiographs/rad-1/annotations/archived-1/restore',
        expect.objectContaining({ method: 'POST' })
    ));
});

test('requires a reason and soft-deletes a dentist finding', async () => {
    const managedRadiograph = {
        ...radiograph,
        annotations: [{ id: 'finding-1', toothNumber: '46', findingType: 'Duplicate observation', status: 'active', geometry: { type: 'point', x: .4, y: .5, width: 0, height: 0 } }],
    };
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Dentist finding deleted.', radiograph: managedRadiograph }) });
    renderPanel({ radiograph: managedRadiograph });
    fireEvent.click(screen.getByRole('button', { name: 'Findings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tooth 46' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete finding' }));
    expect(screen.getByRole('status').textContent).toContain('Enter a reason');
    expect(authFetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Deletion reason' }), { target: { value: 'Duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete finding' }));
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
        '/patients/patient-1/radiographs/rad-1/annotations/finding-1',
        expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ reason: 'Duplicate' }) })
    ));
});

test('renders successful request feedback as a status badge', async () => {
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Saved.' }) });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /run analysis again/i }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Saved.');
    expect(status.className).toContain('successMessage');
});

test('places required manual-review validation directly below the checkbox', () => {
    renderPanel({
        radiograph: {
            ...radiograph,
            reviewSummary: { status: 'draft', draft: 'Dentist-facing generated summary.' },
        },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    const summary = screen.getByDisplayValue('Dentist-facing generated summary.');
    expect(summary.className).toContain('summaryTextarea');
    expect(screen.getByText('*')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Approve summary' }));
    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Please confirm that you manually reviewed this radiograph image before approving the summary.');
    expect(error.parentElement.className).toContain('requiredReviewField');
    expect(screen.queryByRole('status')).toBeNull();
});

test('summary panel exposes readable guidance and omits obsolete model evaluation controls', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.getByText(/create a draft from dentist-recorded findings/i).className).toContain('sectionHelper');
    expect(screen.getByRole('button', { name: /generate summary/i }).className).toContain('secondaryAction');
    expect(screen.queryByText('Model evaluation')).toBeNull();
});

test('shows the approved text instead of a stale draft and requires an explicit revision', () => {
    renderPanel({
        radiograph: {
            ...radiograph,
            manualReview: { reviewedAt: '2026-08-22T00:00:00.000Z', reviewedBy: 'dentist-1' },
            reviewSummary: {
                status: 'approved',
                draft: 'Old generated draft.',
                approvedText: 'Dentist-edited approved summary.',
                approvedAt: '2026-08-22T00:00:00.000Z',
                approvedBy: 'dentist-1',
            },
        },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    const approvedSummary = screen.getByRole('textbox', { name: 'Approved review summary' });
    expect(approvedSummary.value).toBe('Dentist-edited approved summary.');
    expect(approvedSummary.readOnly).toBe(true);
    expect(screen.getByText('Approved').className).toContain('approvedBadge');
    expect(screen.getByRole('button', { name: 'Revise summary' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve summary' })).toBeNull();
});

test('flags an approved summary when dentist findings changed afterward', () => {
    renderPanel({
        radiograph: {
            ...radiograph,
            reviewSummary: {
                status: 'approved',
                approvedText: 'Previously approved summary.',
                approvedAt: '2026-08-22T00:00:00.000Z',
                approvedBy: 'dentist-1',
                findingsChangedAt: '2026-08-23T00:00:00.000Z',
            },
        },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.getByRole('status').textContent).toContain('Summary update needed');
    expect(screen.getByRole('textbox', { name: 'Approved review summary' }).value).toBe('Previously approved summary.');
    expect(screen.getByRole('button', { name: 'Revise summary' })).not.toBeNull();
});

test('starts a separate revision draft while retaining the approved summary', async () => {
    const approvedRadiograph = {
        ...radiograph,
        manualReview: { reviewedAt: '2026-08-22T00:00:00.000Z', reviewedBy: 'dentist-1' },
        reviewSummary: { status: 'approved', approvedText: 'Current approved summary.' },
    };
    const revisingRadiograph = {
        ...approvedRadiograph,
        reviewSummary: { ...approvedRadiograph.reviewSummary, revisionDraft: 'Proposed replacement summary.' },
    };
    const onChange = jest.fn();
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Revision draft created.', radiograph: revisingRadiograph }) });
    const view = renderPanel({ radiograph: approvedRadiograph, onChange });

    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revise summary' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(revisingRadiograph));
    view.rerender(<RadiographReviewPanel patientId="patient-1" radiograph={revisingRadiograph} onChange={onChange} onClose={jest.fn()} onEnhance={jest.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Review summary revision draft' }).value).toBe('Proposed replacement summary.');
    expect(screen.getByText('Revision Draft').className).toContain('draftBadge');
    expect(screen.getByRole('button', { name: 'Approve revision' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel revision' })).not.toBeNull();
    expect(screen.getByText(/currently approved summary remains unchanged/i)).not.toBeNull();

    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Revision cancelled. The previous approved summary was retained.', radiograph: approvedRadiograph }) });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel revision' }));
    await waitFor(() => expect(authFetch).toHaveBeenLastCalledWith(
        '/patients/patient-1/radiographs/rad-1/cancel-summary-revision',
        expect.objectContaining({ method: 'POST' })
    ));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(approvedRadiograph));
    view.rerender(<RadiographReviewPanel patientId="patient-1" radiograph={approvedRadiograph} onChange={onChange} onClose={jest.fn()} onEnhance={jest.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Approved review summary' }).value).toBe('Current approved summary.');
    expect(screen.queryByRole('button', { name: 'Cancel revision' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve revision' })).toBeNull();
});

test('automatically dismisses successful request feedback', async () => {
    jest.useFakeTimers();
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Saved.' }) });
    renderPanel();

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /run analysis again/i }));
        await Promise.resolve();
        await Promise.resolve();
    });
    expect(screen.getByRole('status').textContent).toContain('Saved.');
    act(() => jest.advanceTimersByTime(4500));
    expect(screen.queryByRole('status')).toBeNull();
    jest.useRealTimers();
});

test('compares the preserved original with the enhanced image at the shared zoom', () => {
    renderPanel({ radiograph: { ...radiograph, enhancedUrl: 'data:image/png;base64,ZW5oYW5jZWQ=' } });
    fireEvent.click(screen.getByRole('button', { name: /compare original \/ enhanced/i }));
    expect(screen.getByRole('img', { name: 'Original radiograph' })).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Enhanced radiograph' })).not.toBeNull();
});

test('shows enhancement provenance and records dentist usefulness feedback', async () => {
    const enhancedRadiograph = {
        ...radiograph,
        enhancedUrl: 'data:image/png;base64,ZW5oYW5jZWQ=',
        enhancementVariants: {
            basic: {
                label: 'Adaptive Enhance',
                metadata: {
                    version: 'ngitify-adaptive-radiograph-v1.0.0',
                    profile: 'Periapical',
                    sourceBitDepth: 8,
                    sourceDimensions: { width: 800, height: 600 },
                    before: { brightness: 80, contrast: 20, sharpness: 30 },
                    after: { brightness: 110, contrast: 35, sharpness: 42 },
                    transformations: ['Adaptive denoising'],
                    warnings: [],
                },
                feedback: {},
            },
        },
    };
    authFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Enhancement feedback saved.', radiograph: enhancedRadiograph }) });
    renderPanel({ radiograph: enhancedRadiograph });

    expect(screen.getByLabelText('Enhancement details').textContent).toContain('Adaptive denoising');
    expect(screen.getByLabelText('Enhancement details').textContent).toContain('80.0 → 110.0');
    fireEvent.click(screen.getByRole('button', { name: 'Useful' }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
        '/patients/patient-1/radiographs/rad-1/enhancement-feedback',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ engine: 'basic', rating: 'useful' }) })
    ));
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

test('grab tool freely pans a zoomed image and Fit resets its position', () => {
    const originalPointerEvent = window.PointerEvent;
    window.PointerEvent = MouseEvent;
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const grabButton = screen.getByRole('button', { name: 'Grab' });
    fireEvent.click(grabButton);

    expect(grabButton.getAttribute('aria-pressed')).toBe('true');
    const viewer = screen.getByLabelText('Periapical viewer, grab tool active');
    fireEvent.pointerDown(viewer, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewer, { pointerId: 1, clientX: 165, clientY: 140 });
    fireEvent.pointerUp(viewer, { pointerId: 1, clientX: 165, clientY: 140 });
    expect(viewer.firstChild.style.transform).toBe('translate(65px, 40px) scale(1.25)');

    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    expect(viewer.firstChild.style.transform).toBe('translate(85px, 40px) scale(1.25)');

    fireEvent.click(screen.getByRole('button', { name: /fit/i }));
    expect(viewer.firstChild.style.transform).toBe('translate(0px, 0px) scale(1)');
    window.PointerEvent = originalPointerEvent;
});

test('annotation mode turns off grab mode and saved markers expose details on hover and focus', () => {
    renderPanel({
        radiograph: {
            ...radiograph,
            annotations: [{
                id: 'annotation-1',
                toothNumber: '46',
                findingType: 'Existing restoration',
                note: 'Monitor distal margin.',
                linkToOdontogram: true,
                geometry: { type: 'point', x: .45, y: .55, width: 0, height: 0 },
            }],
        },
    });

    const grabButton = screen.getByRole('button', { name: 'Grab' });
    fireEvent.click(grabButton);
    fireEvent.click(screen.getByRole('button', { name: 'Add annotation' }));
    expect(grabButton.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Periapical viewer').getAttribute('data-annotation-mode')).toBe('true');

    const marker = screen.getByRole('button', { name: 'Tooth 46: Existing restoration' });
    fireEvent.mouseEnter(marker);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Tooth 46');
    expect(tooltip.textContent).toContain('Existing restoration');
    expect(tooltip.textContent).toContain('Monitor distal margin.');
    expect(tooltip.textContent).toContain('Linked to odontogram');
    marker.focus();
    expect(document.activeElement).toBe(marker);
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
