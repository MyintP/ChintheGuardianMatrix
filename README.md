# Chinthe — Guardian Matrix

A mobile-first grappling encyclopedia and training system for BJJ (gi and no-gi), wrestling, judo and MMA — with a competition decision map, scoring, principles and a training journal. Rooted in Myanmar. Forged through Brazilian Jiu-Jitsu.

**Live:** https://myintp.github.io/ChintheGuardianMatrix/

---

Navigate your full game from standing to leg locks — tap any node to drill down, track your chain score, and get real-time match-context guidance based on phase and scoreboard state.

Built with vanilla JS, no dependencies. Single-file, offline-capable once loaded.

## Editing the encyclopedia

Entries live in `kb/*.js`. After any change run `node tools/build-kb.js`, which validates every entry and regenerates `encyclopedia.js` and the search index in `chinthe.js`.

*Alpha — more to come.*
