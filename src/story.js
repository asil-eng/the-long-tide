// All dialogue and on-screen text lives here so it can be edited in one place.
// Level scripts reference lines by key. Voice files are optional: add `voice: '/audio/vo/<file>.mp3'`.

export const CAST = {
  father: 'Father',     // the player (placeholder name until the story is final)
  daughter: 'Daughter',
};

export const STORY = {
  // Neutral lines used only to test the dialogue and cutscene systems.
  systemTest: {
    dialogue: [
      { who: 'System', text: 'Dialogue test. Press Space to finish the line, and again to continue.' },
      { who: 'System', text: 'Second line, typed out character by character.' },
    ],
    subs: [
      { t: 0.5, who: 'System', text: 'Cutscene test: camera path, letterbox bars and timed subtitles.', dur: 3.5 },
      { t: 4.5, text: 'Controls are locked until the shot ends. Escape skips.', dur: 3 },
    ],
  },

  // Level 1 scenes are filled in once the story is settled (see STORY.md).
  farm: {},
};
