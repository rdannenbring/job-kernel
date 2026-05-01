# Implementation Plan - Job Details Stabilization

## Problem Statement
Users are experiencing "Hard Blank" (white screen of death) crashes when navigating to Job Details or switching between jobs. This is likely caused by:
1.  **Null Pointer Exceptions**: Accessing properties on `null` or `undefined` during render (e.g., `Object.entries(undefined)`).
2.  **Auth Failures**: 401 errors during background fetches causing the state to become inconsistent.
3.  **Data Mismatches**: API returning strings where arrays are expected (or vice versa), leading to `.map` failures.

## Proposed Changes

### 1. ApplicationDetail.jsx (Critical)
- [ ] **Data Safety**: Use `safeParseJSON(app.match_details, { criteria_scores: {} })` to ensure `criteria_scores` is always present.
- [ ] **Iteration Guards**: Add `?.` to all `.map()` calls and ensure the target is an array (e.g., `(arr || []).map`).
- [ ] **Component Hardening**: Wrap complex rendering blocks (Commute, Matching) in null-checks.
- [ ] **Auth Sync**: Ensure that if `app` is missing or loading fails, a proper loading state or error message is shown instead of crashing.

### 2. Dashboard.jsx
- [ ] **Score Calculation**: Ensure `avgScore` uses `Number(a.match_score)` to prevent string concatenation bugs.
- [ ] **Type Casting**: Apply `String()` to data fields before using string methods like `.split()`.

### 3. App.jsx
- [ ] **State Synchronization**: Clear `selectedApp` when the user logs out or if the token is invalidated.
- [ ] **Avg Score Consistency**: Update global `avgScore` calculation to be type-safe.

### 4. ApplicationLifecycle.jsx
- [ ] **Section Extraction**: Harden the `extractSection` function to handle empty or malformed text blocks gracefully.

## Verification Plan
1.  **Smoke Test**: Use the browser subagent to click through all 4 jobs and verify no blank screens.
2.  **Malformed Data Test**: Manually set a job's `match_details` to `"{}"` in the DB and verify the UI handles it.
3.  **Auth Expiry Test**: Manually delete the `token` from `localStorage` while on a detail page and verify it redirects to Login without crashing.
