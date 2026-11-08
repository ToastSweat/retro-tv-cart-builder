# NICK1 — Reference Build Record

## Identity

```text
CartID: NICK01
Physical USB label: NICK1
Final reference revision: r009
Toolkit checkpoint: v1.4.1
Checkpoint date: 2026-10-10
```

## Final review result

The checkpoint includes:

```text
EXAMPLES/NICK01-r009-review-state.csv
```

Verified result:

```text
36 total clips
36 GOOD
0 unresolved
```

## Physical testing history

An earlier NICK01 build, around revision r003, was rendered to a physical USB cartridge and watched through on one of the actual Mini Retro TVs.

That viewing pass directly influenced later development.

Problems found during real-device viewing included:
- too many interruptions
- too many commercials/bumpers
- wrong-show branding
- awkward transition rhythm
- baked black-border problems
- audio quality problems
- review-state ambiguity

The final r009 milestone therefore includes both desktop review iteration and prior real-hardware feedback.

The newly built r009 NICK1 physical cartridge is now ready for additional QA by the user and girlfriend.

## Current programming concept

Display name:

```text
Nickelodeon, 1999 Saturday-morning-ish
```

This is intentionally a plausible synthetic broadcast, not an exact historical schedule reconstruction.

## Episode lineup

1. Doug — `Doug Bags a Neematoad`
2. Rocko's Modern Life — `No Pain, No Gain / Who Give$ a Buck`
3. Rugrats — `Tommy's First Birthday`
4. Rugrats — `At The Movies + Slumber Party`
5. Hey Arnold! — `Downtown as Fruits & Eugene's Bike`
6. The Angry Beavers — `Born to Be Beavers & Up All Night`
7. CatDog — `Dog Gone / All You Can't Eat`
8. Aaahh!!! Real Monsters — `The Switching Hour`
9. Doug — `Can't Dance / Gets Busted`
10. Hey Arnold! — `Arnold's Hat & Stoop Kid`
11. The Angry Beavers — `Muscular Beaver & Fish 'n' Dips`
12. Rugrats — `Grandpa's Teeth + Momma Trauma`

## Break configuration

```text
Network: NICK
Commercial pool: KIDS_90S
Ads per break: 1
BreakStyle: LEAN
Matched NEXT: false
scheduled stings: none
```

High-level sequence:

```text
long Nickelodeon anchor
episode
commercial
short transition/bumper
episode
...
Nickelodeon sign-off
```

## Sign-off

A handpicked:

```text
Nickelodeon Good Night Sign Off (1996)
```

was registered into durable handpicked branding and configured as NICK01's sign-off.

## What NICK1 proves

NICK1 is the first end-to-end proof that the system can:

1. ingest curated sources
2. construct a plausible broadcast
3. normalize to the TV format
4. provide a continuous review experience
5. record review findings
6. make non-destructive trims/crops/audio repairs
7. replace inappropriate assets
8. preserve revision history
9. reuse cached work
10. carry approved clips forward
11. reach an all-green review
12. build numbered final MP4s
13. copy them to a labeled physical USB cartridge
14. play the concept on actual target hardware

That is the baseline for every cart that follows.
