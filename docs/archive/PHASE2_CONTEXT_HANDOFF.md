# Phase 2 WebAR Context Handoff

Date: 2026-05-18
Project: Klarheit
Phase: Phase 2 - Self-Owned WebAR Try-On

## Product Decision

The selected Phase 2 route is option A: self-owned WebAR using MediaPipe Face Landmarker and Three.js.

The goal is not a throwaway demo. Klarheit is intended to become a real user-facing product. For this phase, the scope is the first production-grade AR foundation:

- Real camera permission and stream lifecycle.
- MediaPipe face landmark detection.
- Three.js glasses overlay rendering.
- Finish/product switching without full page reload.
- Screenshot capture from the AR view.
- Clear fallback states for denied camera, unsupported browser, no face, low confidence, and runtime errors.

This phase does not require final calibrated `.glb` assets for all 4 products, full mobile device certification, analytics, or launch hardening. Those belong to the next milestone after the AR foundation exists.

## Key Documents

- Design spec: `docs/superpowers/specs/2026-05-18-phase2-webar-tryon-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-18-phase2-webar-tryon.md`
- This handoff: `docs/superpowers/PHASE2_CONTEXT_HANDOFF.md`

## Important Commits On Main

- `a014bdf docs: add phase 2 webar try-on design`
- `1143e3c docs: add phase 2 webar implementation plan`
- `4955e17 chore: ignore local worktrees`

The `.gitignore` now ignores:

- `.superpowers/`
- `.worktrees/`

## Implementation Worktree

Continue implementation from this worktree:

```text
C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon
```

Branch:

```text
codex/phase2-webar-tryon
```

Do not continue implementation directly on the main checkout unless intentionally merging/integrating.

## Baseline Verification

Baseline checks were run in:

```text
C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon\front_end
```

Results:

- `npm install`: completed, no vulnerabilities.
- `npm test`: 3 files, 14 tests passed.
- `npm run lint`: `tsc --noEmit` passed.

## Execution Method

The selected execution method is Superpowers subagent-driven development.

Workflow per task:

1. Dispatch implementer subagent for one task.
2. Implementer runs required tests and commits.
3. Dispatch spec compliance reviewer.
4. If spec review fails, send the same implementer back to fix.
5. After spec compliance passes, dispatch code quality reviewer.
6. If code quality review fails, send the same implementer back to fix.
7. Mark the task complete and continue to the next task.

Do not skip either review stage.

## Completed Task 1: Add AR Runtime Dependencies

Task 1 added WebAR runtime dependencies to the frontend.

Commits in the worktree:

- `02ad037 chore(ar): add webar runtime dependencies`
- `d0c3285 chore(ar): move three types to dev dependencies`

Final dependency placement:

- `three` in `dependencies`
- `@mediapipe/tasks-vision` in `dependencies`
- `@types/three` in `devDependencies`

Verification:

```powershell
cd C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon\front_end
npm ls three @types/three @mediapipe/tasks-vision
```

Result:

- `@mediapipe/tasks-vision@0.10.35`
- `@types/three@0.184.1`
- `three@0.184.0`
- No `UNMET DEPENDENCY`.

Reviews:

- Spec compliance: passed.
- Code quality: passed after moving `@types/three` to `devDependencies`.

## Completed Task 2: Define AR Types and Frame Catalog

Task 2 created the shared AR type surface and static frame catalog.

Commit in the worktree:

```text
c85b7ad feat(ar): define try-on frame catalog
```

Files added:

- `front_end/src/ar/types.ts`
- `front_end/src/ar/frameCatalog.ts`

`types.ts` exports:

- `CameraStatus`
- `TrackingStatus`
- `ArExperienceStatus`
- `ArFinishId`
- `FaceLandmark`
- `ArTransform`
- `ArFrameConfig`

`frameCatalog.ts` exports:

- `AR_FRAME_CATALOG`
- `DEFAULT_AR_FINISH`
- `getArFrameConfig`

Frame finishes currently defined:

- `matte-black`
- `titanium`
- `rose-gold`

Verification:

```powershell
cd C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon\front_end
npm run lint
```

Result:

- `tsc --noEmit` passed.

Reviews:

- Spec compliance: passed.
- Code quality: approved.

Minor non-blocking review notes:

- `ArTransform` and `transformOffset` use raw numeric tuples. Future maintainers may benefit from comments documenting coordinate space, units, and Euler rotation order.
- Both `AR_FRAME_CATALOG` and `getArFrameConfig` are exported. Downstream code should standardize on one access style, preferably `getArFrameConfig`, to reduce drift.

## Next Task: Task 3 - Build Calibration Math With TDD

Continue with Task 3 from:

```text
docs/superpowers/plans/2026-05-18-phase2-webar-tryon.md
```

Task 3 files:

- Create `front_end/src/ar/arCalibration.test.ts`
- Create `front_end/src/ar/arCalibration.ts`

Required function:

```ts
calculateGlassesTransform(landmarks: FaceLandmark[]): ArTransform | null
```

Planned landmark indices:

- `33`: left eye outer
- `263`: right eye outer
- `168`: nose bridge
- `1`: nose tip

TDD sequence:

1. Write `arCalibration.test.ts`.
2. Run the test and verify RED because `./arCalibration` does not exist.
3. Implement `arCalibration.ts`.
4. Run the test and verify GREEN.
5. Commit with:

```powershell
git commit -m "feat(ar): add face landmark calibration"
```

Then run:

- Spec compliance review.
- Code quality review.

## Remaining Planned Tasks

After Task 3, continue in this order:

1. Task 4: Build `useCameraStream` with TDD.
2. Task 5: Build MediaPipe face tracking adapter and `useFaceLandmarks` with TDD.
3. Task 6: Build `ArTryOnCanvas` with Three.js.
4. Task 7: Refactor `ARVirtualStudio.tsx` into real runtime states.
5. Task 8: Final verification and browser check.

Final verification commands:

```powershell
cd C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon\front_end
npm test
npm run lint
npm run build
```

Manual/browser verification target:

```text
http://localhost:3000/virtual-studio
```

Expected manual checks:

- Page uses live AR layer instead of static fake AR background.
- `Start Camera` requests camera permission in a supported browser.
- Permission denial shows camera-blocked state.
- Unsupported camera APIs show unsupported-browser state.
- Finish selector updates rendered frame color without navigation.
- Config Lab link remains usable.

## Current Known Constraints

- Continue in the worktree, not the main checkout.
- Keep tasks serial unless explicitly coordinating non-overlapping files.
- Do not revert user changes.
- Use TDD for implementation tasks.
- Use `apply_patch` for manual file edits.
- Keep commits focused per task.
- If subagent thread limit is reached, close completed agents and continue.

## Suggested Resume Prompt

Use this in a new window:

```text
Continue Phase 2 WebAR implementation for Klarheit from docs/superpowers/PHASE2_CONTEXT_HANDOFF.md. Use the worktree at C:\Users\17761\Desktop\Klarheit\.worktrees\phase2-webar-tryon on branch codex/phase2-webar-tryon. Task 1 and Task 2 are complete and reviewed. Continue with Task 3 from docs/superpowers/plans/2026-05-18-phase2-webar-tryon.md using subagent-driven development and TDD.
```
