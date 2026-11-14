# Battle Tower design

The former exploration RPG is retired. Progression is physical skill acquisition, records and challenge achievements; no XP, levels or purchased stats.

There are30 skills, four free introductory trials, up to four equipped unlocked skills, and7 fixed-loadout challenges. Infinite runs begin at floor1 outside developer preview; floors are generated independently from seed and floor through1,000,000,000. Floor generation is memory-constant. Records count completed floors. Rest has no timeout.

Leg→Arm→Back→Leg has1.5 effectiveness, reverse0.75, same1. STAB1.25. Defender halves the next hit. Each accepted rep/held second deals its share of skill power immediately. Enemy response waits for series completion/cancellation. Phase thresholds cap excess damage and close the series before transformation.

Workout is independent of combat. A sequence snapshots its routine, accepts exact unique exercise events, and maps these to thirty different scene actions. Manual or mixed results do not receive unearned technique ratings. All goals can be paused, recalibrated or skipped; skipped work is incomplete. Targets split into at most12rep or30second series; alternating sets stay even. These are configurable game limits, not individualized exercise prescriptions.

Detection status, setup and limitations are explicit in catalog/skillGuides. Backend and renderer consume the same definitions. Completing workouts does not alter tower-floor records or unlock specializations.
