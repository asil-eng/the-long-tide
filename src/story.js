// THE LONG TIDE: every line of dialogue and on-screen text, in one editable file.
// Level scripts reference these by key. Optional voice files: add `voice: '/audio/vo/<file>.mp3'` to a line.
// Subtitle lines in cutscenes use { t: secondsFromStart, who, text, dur }.

export const CAST = {
  eli: 'Eli', june: 'June', wes: 'Wes', ada: 'Ada', okafor: 'Dr. Okafor',
  reyes: 'Reyes', ward: 'Ward', radio: 'Radio', june29: 'June', june39: 'June', oldJune: 'June',
};
const C = CAST;

export const STORY = {
  title: { name: 'The Long Tide', tagline: 'Channel nine. Always channel nine.' },

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

  // ======================= LEVEL 1: THE FARM =======================
  farm: {
    openingCard: 'The Harlan farm<br><small style="font-size:.5em;letter-spacing:.3em">the dust season</small>',

    // Scene 1: supper on the porch
    supperSubs: [
      { t: 0.6, who: C.radio, text: '…dust advisory for the county through Thursday. Keep livestock in. Keep children in.', dur: 4.4 },
      { t: 5.4, who: C.ada, text: 'Kitchen\'s got more dirt in it than the field. We eat outside.', dur: 3.6 },
      { t: 9.4, who: C.wes, text: 'Outside\'s got dirt too, Gran.', dur: 2.6 },
      { t: 12.2, who: C.ada, text: 'Outside\'s supposed to.', dur: 2.4 },
    ],
    supperDialogue: [
      { who: C.june, text: 'Dad. Listen. It\'s doing it again.' },
      { who: C.eli, text: 'That\'s just the wind getting into your aerial.' },
      { who: C.june, text: 'Wind doesn\'t count. This counts. Three slow, two fast. Every time.' },
      { who: C.ada, text: 'It\'s interference, sweetheart. The whole sky\'s full of grit.' },
      { who: C.june, text: 'Then the grit is trying very hard to say something.' },
      { who: C.eli, text: 'Write it down. Every click. If it\'s real, it\'ll still be real tomorrow.' },
      { who: C.wes, text: 'Dad. Up there, over the east field. Something silver.' },
    ],

    // Scene 2: the balloon chase
    objectiveChase: 'Take the truck. Follow the balloon.',
    chaseStart: [
      { who: C.wes, text: 'It\'s coming down. Weather balloon, maybe. Somebody\'s.' },
      { who: C.eli, text: 'Get in. Watch the meter on the dash. It\'s squawking on the same band as June\'s radio.' },
    ],
    chaseBarks: [
      { who: C.wes, text: 'Left! It\'s drifting left!', at: 0.25 },
      { who: C.wes, text: 'You\'re flattening the Hollisters\' corn.', at: 0.5 },
      { who: C.eli, text: 'The Hollisters left two years ago.', at: 0.52 },
      { who: C.wes, text: 'It\'s low. It\'s really low now.', at: 0.8 },
    ],
    balloonDown: [
      { who: C.wes, text: 'It\'s down. Past the rows. There.' },
    ],
    objectivePayload: 'Recover the payload.',
    payloadFound: [
      { who: C.eli, text: 'Observatory stamp. Okafor\'s people, out past the east road.' },
      { who: C.wes, text: 'There\'s a tape inside. It\'s still running.' },
      { who: C.eli, text: 'Then we take it home before the storm takes it first.' },
    ],

    // Scene 3: the storm and the tape
    objectiveHome: 'Get home before the storm.',
    stormSubs: [
      { t: 0.5, who: C.ada, text: 'Wall\'s coming! Everybody in. Wet cloths on your faces.', dur: 3.4 },
      { t: 4.2, who: C.june, text: 'Bring the tape up to my room. My radio\'s up there.', dur: 3.2 },
    ],
    objectiveRoom: 'Go up to June\'s room.',
    puzzleIntro: [
      { who: C.june, text: 'The tape has the same clicks. Look, the marks. But it\'s slower.' },
      { who: C.eli, text: 'Recorded at a different speed. Line it up with yours.' },
    ],
    puzzleHelp: 'A / D shift the tape · W / S change its speed · line the marks up with the live clicks',
    puzzleSolved: [
      { who: C.june, text: 'It matches. It matches all the way.' },
      { who: C.june, text: 'K… E… S… T… R… E… L. Kestrel two. Power failing. Route at risk.' },
      { who: C.eli, text: '…' },
      { who: C.june, text: 'Dad? You know what it is.' },
      { who: C.eli, text: 'I flew it out there. Eleven years ago. It was supposed to outlive all of us.' },
      { who: C.eli, text: 'Stay with your gran. I\'m taking this back to the people who lost it.' },
    ],

    // Scene 4: the night drive
    objectiveObservatory: 'Drive the payload to the observatory at the end of the east road.',
    observatorySubs: [
      { t: 0.8, who: C.okafor, text: 'Eli Harlan. I hoped it would be you that found it, and I hoped it wouldn\'t.', dur: 4.2 },
      { t: 5.4, who: C.eli, text: 'Your balloon was talking on my daughter\'s radio.', dur: 3.0 },
      { t: 8.8, who: C.okafor, text: 'Then she heard what we\'ve been hearing for six months. Kestrel is dying.', dur: 4.0 },
      { t: 13.2, who: C.okafor, text: 'The colony ships are almost ready. The route lives in that relay. Without it they fly blind.', dur: 4.8 },
      { t: 18.4, who: C.eli, text: 'Then send a crew.', dur: 2.2 },
      { t: 21.0, who: C.okafor, text: 'We have a ship. We have a crew. We don\'t have a pilot who\'s flown that lane.', dur: 4.2 },
      { t: 25.6, who: C.okafor, text: 'Out there, time runs slow for you and fast for them. You\'d come back to a different world.', dur: 4.8 },
      { t: 31.0, who: C.eli, text: 'If I don\'t go, there isn\'t a different world.', dur: 3.4 },
    ],

    // Scene 5: the goodbye
    morningCard: 'The next morning',
    objectiveDoor: 'Talk to June.',
    doorDialogue: [
      { who: C.eli, text: 'June. Open the door.' },
      { who: C.june, text: 'No.' },
      { who: C.eli, text: 'I can\'t fix this from the porch, kid.' },
      { who: C.june, text: 'You said the clicks would still be real tomorrow. You didn\'t say you\'d be gone tomorrow.' },
      { who: C.eli, text: 'I\'m leaving you one of these. The other one comes with me. Channel nine.' },
      { who: C.june, text: 'They only reach as far as the fence.' },
      { who: C.eli, text: 'Then I\'ll make them reach farther.' },
    ],
    objectiveShelf: 'Leave the walkie-talkie on her bookshelf.',
    objectiveLeave: 'Drive to the observatory.',
    departureSubs: [
      { t: 1.0, who: C.june, text: 'Dad!', dur: 1.6 },
      { t: 3.2, who: C.june, text: 'Channel nine. You hear me? Channel nine!', dur: 3.2 },
      { t: 7.0, who: C.eli, text: 'I hear you, Junebug. Always.', dur: 3.0 },
    ],
    weeksCard: 'Three weeks later',
    launchSubs: [
      { t: 1.5, who: C.ada, text: 'There he goes.', dur: 2.6 },
      { t: 6.0, who: C.june, text: 'Channel nine, Dad. I\'ll keep it on.', dur: 3.6 },
    ],
  },

  // ======================= LEVEL 2: TRANSIT =======================
  transit: {
    card: 'Two years later. Beyond Jupiter.',
    messages: [
      { who: C.reyes, text: 'Hi Mom. The food\'s terrible. The view\'s worth it. Mostly.' },
      { who: C.ward, text: 'Recording for the archive. All systems nominal. All of us, nominal.' },
      { who: C.eli, text: 'June. Wes. I\'m fine. Keep the radio on. That\'s all. That\'s everything.' },
    ],
  },

  // ======================= LEVEL 3: THE TIDE WORLD =======================
  tide: {
    landing: [
      { who: C.ward, text: 'I\'m holding the ship out here. Every hour you spend down there is five years up here. Five years at home.' },
      { who: C.reyes, text: 'So no sightseeing. Got it. Wet socks, though. Nobody warned me about the wet socks.' },
      { who: C.eli, text: 'Beacon\'s two hundred metres out. We walk, we dig, we leave.' },
    ],
    coreFound: [
      { who: C.reyes, text: 'There she is. Half buried. Stubborn little thing.' },
      { who: C.eli, text: 'Dig. Fast.' },
    ],
    surge: [
      { who: C.ward, text: 'Eli, your horizon. That\'s not mountains.' },
      { who: C.eli, text: 'Reyes, drop it! Back to the shuttle!' },
      { who: C.reyes, text: 'One second, I\'ve got the coupler—' },
    ],
    lost: [
      { who: C.eli, text: 'Reyes. Reyes!' },
      { who: C.ward, text: 'His signal\'s gone, Eli. I\'m sorry. Get the engines dry and come home.' },
    ],
    returnAboard: [
      { who: C.ward, text: 'Nineteen years. I stopped counting out loud after ten. It was getting hard to hear.' },
      { who: C.eli, text: 'Sela…' },
      { who: C.ward, text: 'There\'s a lot of mail for you. Take your time. You have more of it than I did.' },
    ],
    messages: [
      { who: 'June, 12', text: 'You missed my birthday. Gran made a cake out of mostly nothing. It was good. I\'m still mad.' },
      { who: 'Wes, 18', text: 'Harvest failed again. I\'m keeping the farm going. Somebody has to be here when you get back.' },
      { who: 'June, 17', text: 'I finished the radio. A real one. It reaches past the fence now. You\'re still not on it.' },
      { who: 'June, 23', text: 'Dr. Okafor gave me a job. I listen to Kestrel all day. It sounds tired. Like me.' },
      { who: 'June, 29', text: 'I\'m going to stop saying Dad in these. It makes it harder. Eli, the relay has maybe ten years left.' },
      { who: 'June, 29', text: 'If you\'re hearing this, you\'re late. Be late faster.' },
    ],
  },

  // ======================= LEVEL 4: THE RELAY =======================
  relay: {
    arrive: [
      { who: C.ward, text: 'There it is. Kestrel-2. It looks like a dead bird.' },
      { who: C.eli, text: 'It\'s not dead. It\'s waiting.' },
    ],
    stuck: [
      { who: C.eli, text: 'The manual\'s twenty years old. Half these panels aren\'t in it.' },
    ],
    // the radio lag is part of the gameplay: June's answers arrive after a delay
    radio: [
      { who: C.june39, text: '…channel nine. Eli, if you\'re there, I\'ve been waiting a long time to say this. Don\'t touch the left coupling.', lag: 0 },
      { who: C.eli, text: 'June?' },
      { who: C.june39, text: 'I can hear you. Four minutes late, but I hear you. I know this relay better than the people who built it. I\'ve had twenty years.', lag: 8 },
      { who: C.june39, text: 'Right coupling first. Then the lower ring. Then the core. Count to three between each. It sulks.', lag: 4 },
    ],
    couplingDone: [
      { who: C.june39, text: 'Good. I can hear it breathing again.', lag: 6 },
    ],
    choice: [
      { who: C.june39, text: 'Eli. The numbers. To send the whole route it needs everything, including your burn home.', lag: 6 },
      { who: C.eli, text: 'I know.' },
      { who: C.june39, text: 'Don\'t you dare be noble at me. I\'ve waited my whole life.', lag: 6 },
      { who: C.eli, text: 'You kept the channel open. You kept me going for twenty years and I didn\'t even know it was you.' },
      { who: C.eli, text: 'Send it, June. Let them have the way.' },
      { who: C.june39, text: '…sending.', lag: 6 },
    ],
  },

  // ======================= ENDING =======================
  ending: {
    card: 'Years later',
    walk: [
      { who: 'Pilot', text: 'Harlan farm. Last stop. The valley\'s green now. Took a long time.' },
    ],
    porch: [
      { who: C.oldJune, text: 'You\'re late.' },
      { who: C.eli, text: 'I came as fast as the dark allowed.' },
      { who: C.oldJune, text: 'I kept it on. Every night. Channel nine.' },
      { who: C.eli, text: 'I know. I heard you the whole way.' },
      { who: C.oldJune, text: 'Sit down, Dad. Just sit. We\'ve got time now.' },
    ],
    final: [
      { t: 1.0, who: C.radio, text: '· · ·   — —   · · ·', dur: 3 },
      { t: 5.0, who: C.ward, text: 'Longtide crew, we\'re down. It\'s green here.', dur: 4 },
    ],
    endCard: 'The End',
  },
};
