# The Long Tide

An original story for a single-player, third-person browser game. A farmer who used to fly test ships leaves his daughter on a dying, dust-choked farm to save a failing deep-space relay, the only thing that can guide humanity's colony ships to a new world. Time runs slower for him than for her. The only line between them is a pair of old walkie-talkies on channel 9.

All dialogue is written for this game and lives in `/src/story.js`. Read the matching section here before building each level.

## Characters

| Character | Who they are | In the game |
| --- | --- | --- |
| **Eli Harlan** (the player) | Farmer in his late 30s. Years ago he flew the test ships that carried the Kestrel relay out of the solar system. Widower. | Playable in every level |
| **June Harlan** | His daughter: 10 on the farm, then an engineer at the observatory, then an old woman | Radio, the bedroom, messages, the finale's voice, the ending |
| **Wes Harlan** | His son, 14, steady and quiet | Farm (the balloon chase), messages |
| **Ada Harlan** | Eli's mother, sharp-tongued, lives on the farm | Farm (supper) |
| **Dr. Nia Okafor** | Runs the half-buried observatory at the valley's edge | Farm (night drive), mission briefings |
| **Tomas Reyes** | Mission engineer, jokes when he's scared | Tide World (lost in the surge) |
| **Sela Ward** | Mission biologist and second pilot | Tide World, the relay, the ending's final line |
| **KESTREL-2** | The relay probe: a deep-space beacon that maps the route to the colony world and is now failing | Its clicking distress call drives the plot |

## The time counter

A corner HUD reads "YEARS PASSED AT HOME" and "JUNE'S AGE". It barely moves on Earth and in transit. On the Tide World, one hour there costs five years at home. In game time, one real minute on the Tide World costs 2.5 years at home.

## Level 1: The Farm (about 8–10 minutes)

Golden hour, then a dust storm, then night, then the next morning. The farm valley is open to explore between scenes.

**Scene 1. Supper on the porch.** A dust warning crackles on the kitchen radio. The family eats on the porch because the kitchen is full of grit. June has built a radio out of salvaged parts, and it keeps picking up a slow, repeating click. Ada thinks it's interference. June thinks it's a voice.

**Scene 2. The balloon chase (gameplay).** Wes spots a silver weather balloon sinking over the east fields, trailing a payload box. Eli and Wes chase it in the truck, straight through the corn, following a signal meter on the dash until it comes down. The player recovers the payload. It's stamped with the observatory's mark.

**Scene 3. The storm and the tape (puzzle).** A dust storm rolls in. In June's room, with the storm against the window, the player lines up the payload's tape log with the live clicks on June's radio: shift the tape and set the speed until the marks match. Decoded, the clicks are a distress call: *KESTREL-2. Power failing. Route data at risk.* Eli knows the name. He flew it out there.

**Scene 4. The night drive.** Eli drives the payload to the half-buried observatory at the far end of the valley road. Behind a chain-link fence, under floodlights, Dr. Okafor explains. The crops are failing everywhere. Colony ships are almost ready, but the route to the new world lives in Kestrel-2, and Kestrel is dying. Someone has to fly out and fix it, and Eli is the last pilot who knows that ship.

**Scene 5. The goodbye.** The next morning, June sits on her bed facing the window and won't look at him. Eli talks to her back, then leaves one of the pair of walkie-talkies on her bookshelf. He keeps the other, set to channel 9. He drives away. June runs onto the porch too late, holding the walkie-talkie. Weeks later, from the same porch, she watches a launch trail climb over the hills. Fade to white.

## Level 2: Transit (text card or short cutscene)

Two years of sleep, then a slingshot around Jupiter to reach the outer dark. The crew records messages home. Eli's is short. The ship, the *Longtide*, drops into a gravity well beside a heavy, dim planet whose shallow-ocean moon shelters the wreck of Kestrel-2's spare core.

Cheap version: a 20-second camera move past Jupiter and a text card.

## Level 3: The Tide World (about 5 minutes)

**Look:** ankle-to-knee-deep pale aqua water to the horizon, a pearl-white sky, and the giant planet filling a third of the sky with a faint gold ring of light around its limb. The tide here is the planet's pull, and it arrives as a surge.

**Gameplay:** wade toward the spare core's beacon while the time counter races. Retrieve the core. When the surge rises on the horizon, get back to the shuttle before it hits.

**Beats:**
1. **Landing.** Ward stays aboard the *Longtide*, far enough out that her clock runs normally. Reyes jokes about wet socks.
2. **The core.** It's half buried in silt, and the player digs it out.
3. **The surge.** A wall of water rises on the horizon. Eli gets the core aboard, but Reyes goes back for a dropped tool and the surge takes him.
4. **The cost.** The shuttle's engines are flooded, and they wait while the counter climbs.
5. **The messages (the emotional peak).** Back aboard, Ward has aged; she waited 19 years alone. Eli plays years of radio messages from June in one sitting: June at 12, angry; at 17, quiet; at 23, at the observatory; at 29, an engineer who has stopped saying "Dad" and started saying "Eli". Staged as a simple cockpit screen with a slow piano.

## Level 4: The Relay (the finale, about 5 minutes)

Kestrel-2 hangs at the edge of the system, a lattice of dead panels and one faint light. Eli spacewalks to it in zero-g. The relay is too far gone to fix from the manual alone.

The walkie-talkie crackles. After a long delay, it's June: 39 now, the observatory's chief engineer, who has spent her life studying this relay. She talks him through the repair. Every exchange has a lag of minutes, so the player acts on her instructions and waits for her answers.

**Gameplay:**
1. Float between panels and reconnect three power couplings in the order June gives.
2. Re-seat the spare core from the Tide World.
3. **The choice.** Sending the full route home needs all of the relay's power, including the burn that would carry Eli back. June figures it out before he says it. He sends it anyway.

**The realization:** for twenty years, the voice that kept him going was not the mission. It was her, on channel 9.

## Ending (about 3 minutes)

1. **Home.** Decades later, a slow return. Eli steps off a small transport onto a green, re-planted valley. The colony ships left years ago. Some people stayed to heal the Earth.
2. **The porch.** The farmhouse has been rebuilt. June is old, in a chair on the porch, the other walkie-talkie in her lap.
3. **The reunion.** They talk a little. Mostly they sit.
4. **Final shot.** From the walkie-talkie on her lap, a faint, steady click: Kestrel-2, still sending the way. Then Ward's voice, very far away, from the new world: "Longtide crew, we're down. It's green here." Fade to black.

**Final text card:** "The End." Then the credits, including every free asset and sound used.

## Build order

1. The Farm: all five scenes playable.
2. Transit: a text card or short cutscene.
3. The Tide World: water, the surge, the time counter, the message screen.
4. The Relay: zero-g movement, the couplings, the radio lag, the choice.
5. The Ending: the porch.

Cut in this order if time runs short: the Transit flight (keep the card), the Relay's zero-g movement (keep the radio dialogue over a cutscene), the Ending's walk (go straight to the porch).
