# Forecast for Nowhere

A radio for islands that aren't there. You tune a shortwave dial between weather broadcasts for six imaginary islands.
The stations bleed into each other, so the dial physically mixes their voices, carrier tones, static and heterodyne
whistles. Stay on a station long enough to hear its broadcast and it goes in your log. Log all six and something starts
broadcasting in the gap between two of them.

Play: https://arnavjhajharia.github.io/forecast-for-nowhere/ (desktop or phone, headphones recommended, about 6-10 minutes)

Controls: drag the dial strip or the knob, use the mouse wheel, or press ← / → (hold Shift for fine tuning).

- The writing, code and all radio sound (static, whistles, the counting pips, station drones) are original. The radio
  sound is synthesised live in WebAudio, with no samples.
- AI disclosure: the island paintings are GPT Image 2.5 via Higgsfield, from original prompts that share one style line. The
  seven broadcasts are ElevenLabs text-to-speech via Higgsfield. Claude helped write the code.
- `tools/mixdown.mjs` re-creates the in-game mix offline along a scripted dial path, and the trailer audio comes from it.
