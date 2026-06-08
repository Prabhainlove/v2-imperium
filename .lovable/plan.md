# Cinematic Katana Entrance — Director's Cut

## Problem today
- Scrolling just moves the hero up; the camera barely changes because `heroProgressRef` is driven across only Hero + KeepScrolling, transitions are queued at 0.4–0.8s so they feel smooth-drift not scroll-locked, and Sketchfab lighting is never touched, so the blade can fall into shadow during the orbit/strike beats.
- There is no actual "strike" — no flash, no impact, no handoff into the next section.

## Goal
Treat the hero as a single pinned cinematic shot. As the user scrolls, the katana plays a 5-beat sequence ending in a real strike that vis