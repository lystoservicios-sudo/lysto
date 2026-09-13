# Compact Marketing Footer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Shorten the marketing footer while preserving its upper content and adding the linked Kazecode credit.

**Architecture:** Update the shared marketing footer so every public page receives the same compact lower strip. Add scoped responsive CSS for a single desktop row and stacked mobile rows.

**Tech Stack:** Next.js, React, CSS, Vitest

---

### Task 1: Compact footer content and layout

**Files:**
- Modify: `components/marketing/shared.tsx`
- Modify: `components/marketing/marketing.css`
- Test: `tests/unit/marketing-navigation.vitest.test.tsx`

**Step 1:** Add assertions for the Kazecode credit and legal links.

**Step 2:** Run the focused test and verify it fails for the missing credit.

**Step 3:** Add the credit link and compact desktop/mobile footer styles.

**Step 4:** Run the focused test and lint the changed files.

**Step 5:** Commit, push `main`, deploy to production, and visually verify desktop and mobile.

