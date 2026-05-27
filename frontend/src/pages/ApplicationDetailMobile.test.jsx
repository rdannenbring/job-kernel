import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock CSS import (jsdom has no stylesheet engine)
vi.mock('./ApplicationDetailMobile.css', () => ({}));

// Mock InterestStars (renders fine, but avoid unrelated complexity)
vi.mock('../components/InterestStars', () => ({
  default: ({ level }) => <span data-testid="interest-stars">{level}</span>,
}));

// Mock PipelineProgressBar — we only use STAGE_TO_STATUS from it
vi.mock('../components/PipelineProgressBar', () => ({
  STAGE_TO_STATUS: {
    saved: 'Saved', generated: 'Generated', applied: 'Applied',
    interviewing: 'Interviewing', decision: 'Decision', accepted: 'Accepted',
    rejected: 'Rejected', declined: 'Declined', withdrawn: 'Withdrawn',
  },
}));

// Mock ApplicationLifecycle — computeStageProgress and panel stubs
vi.mock('./ApplicationLifecycle', () => ({
  computeStageProgress: () => ({ saved: { completed: 2, total: 5 } }),
  GeneratedSubStagePanel: () => null,
  AppliedSubStagePanel: () => null,
  InterviewingSubStagePanel: () => null,
  DecisionSubStagePanel: () => null,
  AcceptedSubStagePanel: () => null,
}));

// Mock AuthContext — provide a controllable fetchWithAuth spy
const mockFetchWithAuth = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ fetchWithAuth: mockFetchWithAuth }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeApp = (overrides = {}) => ({
  id: 1,
  job_title: 'Software Engineer',
  company: 'Acme Corp',
  pipeline_stage: 'generated',
  status: 'Generated',
  compatibility_score: 84,
  salary_range: '$120K/yr',
  job_location: 'Remote',
  job_type: 'Full-time',
  tailored_resume_path: null,
  cover_letter_path: null,
  ...overrides,
});

// Lazily import the component under test so mocks are in place first
const loadComponent = async () => {
  const mod = await import('./ApplicationDetailMobile.jsx');
  return { Mobile: mod.default, useIsMobile: mod.useIsMobile };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ApplicationDetailMobile', () => {
  beforeEach(() => {
    mockFetchWithAuth.mockResolvedValue({ ok: false, json: async () => ({ matches: [] }) });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ── Test 1: Tapping a dot only updates preview — no API call ─────────────

  it('tapping a stage dot changes preview without calling the mutation API', async () => {
    const { Mobile } = await loadComponent();
    const app = makeApp({ pipeline_stage: 'generated' });

    await act(async () => {
      render(<Mobile app={app} onBack={vi.fn()} onUpdate={vi.fn()} onStartFullGeneration={vi.fn()} />);
    });

    // Clear the linkedin-connections fetch call made on mount
    mockFetchWithAuth.mockClear();

    // Stage dots live in the "Pipeline stages" tablist, role="tab"
    const pipelineTablist = screen.getByRole('tablist', { name: /Pipeline stages/i });
    const dots = within(pipelineTablist).getAllByRole('tab');
    expect(dots.length).toBe(6);

    // Tap the first dot (Saved — a past stage)
    await act(async () => {
      fireEvent.click(dots[0]);
    });

    // Preview card should appear, but no mutation PUT should have been called
    expect(mockFetchWithAuth).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  // ── Test 2: Rollback button only visible when previewing a past stage ─────

  it('renders rollback button only when previewing a past stage', async () => {
    const { Mobile } = await loadComponent();
    const app = makeApp({ pipeline_stage: 'generated' });

    await act(async () => {
      render(<Mobile app={app} onBack={vi.fn()} onUpdate={vi.fn()} onStartFullGeneration={vi.fn()} />);
    });

    // No rollback button initially (viewing current stage)
    expect(screen.queryByText(/Move pipeline back here/i)).toBeNull();

    // Tap the Saved dot (index 0 = past stage)
    const pipelineTablist = screen.getByRole('tablist', { name: /Pipeline stages/i });
    const dots = within(pipelineTablist).getAllByRole('tab');
    await act(async () => { fireEvent.click(dots[0]); });

    // Rollback button should now be visible
    expect(screen.getByText(/Move pipeline back here/i)).toBeTruthy();

    // Tap the Accepted dot (index 5 = future stage)
    await act(async () => { fireEvent.click(dots[5]); });

    // Rollback button should be gone (future stage, not past)
    expect(screen.queryByText(/Move pipeline back here/i)).toBeNull();
  });

  // ── Test 3: Rollback and end-state show ConfirmModal before mutating ──────

  it('rollback shows ConfirmModal and only mutates on confirm click', async () => {
    const { Mobile } = await loadComponent();
    const onUpdate = vi.fn();
    const app = makeApp({ pipeline_stage: 'generated' });

    mockFetchWithAuth.mockResolvedValue({ ok: true, json: async () => ({}) });

    await act(async () => {
      render(<Mobile app={app} onBack={vi.fn()} onUpdate={onUpdate} onStartFullGeneration={vi.fn()} />);
    });

    // Preview Saved (a past stage)
    const pipelineTablist = screen.getByRole('tablist', { name: /Pipeline stages/i });
    const dots = within(pipelineTablist).getAllByRole('tab');
    await act(async () => { fireEvent.click(dots[0]); });

    mockFetchWithAuth.mockClear();

    // Click rollback button
    await act(async () => {
      fireEvent.click(screen.getByText(/Move pipeline back here/i));
    });

    // ConfirmModal should be visible — no PUT yet
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockFetchWithAuth).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/'),
      expect.objectContaining({ method: 'PUT' }),
    );

    // Click the confirm button in the modal
    await act(async () => {
      fireEvent.click(screen.getByText(/Move back to Saved/i));
    });

    // Now the PUT should have been called
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/1'),
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(onUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ pipeline_stage: 'saved' }));
  });

  // ── Test 4: Forward CTA fires mutation immediately, no modal ─────────────

  it('forward CTA advances stage immediately without showing ConfirmModal', async () => {
    const { Mobile } = await loadComponent();
    const onUpdate = vi.fn();
    // Use 'generated' stage so next is 'applied' — a simple advance, not saved→generate
    const app = makeApp({ pipeline_stage: 'generated' });

    mockFetchWithAuth.mockResolvedValue({ ok: true, json: async () => ({}) });

    await act(async () => {
      render(<Mobile app={app} onBack={vi.fn()} onUpdate={onUpdate} onStartFullGeneration={vi.fn()} />);
    });

    mockFetchWithAuth.mockClear();

    // Click the sticky CTA
    const cta = screen.getByText(/Mark as Applied/i);
    await act(async () => { fireEvent.click(cta); });

    // No ConfirmModal should appear
    expect(screen.queryByRole('dialog')).toBeNull();

    // The PUT should have been called directly
    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/1'),
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(onUpdate).toHaveBeenCalledWith(1, expect.objectContaining({ pipeline_stage: 'applied' }));
  });

  // ── Test 5: useIsMobile breakpoint — 768px swap ───────────────────────────

  it('useIsMobile returns true at ≤768px and false at >768px', async () => {
    const { useIsMobile } = await loadComponent();

    // Helper: render the hook in a minimal component and return the value
    let hookValue;
    function HookHarness({ width }) {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
      hookValue = useIsMobile();
      return null;
    }

    // Mobile viewport
    await act(async () => { render(<HookHarness width={400} />); });
    expect(hookValue).toBe(true);
    cleanup();

    // Desktop viewport
    await act(async () => { render(<HookHarness width={1280} />); });
    expect(hookValue).toBe(false);
    cleanup();

    // Exactly at breakpoint — should be considered mobile
    await act(async () => { render(<HookHarness width={768} />); });
    expect(hookValue).toBe(true);
  });
});
