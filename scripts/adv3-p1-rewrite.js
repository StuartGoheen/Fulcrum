#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'adventures', 'adv3.json');
const adv = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const p1 = adv.parts.find(p => p.id === 'adv3-p1');
const byId = id => p1.scenes.find(s => s.id === id);

// ============================================================================
// SCENE 1 — THE BRICK WALL
// ============================================================================
const s1 = byId('adv3-p1-s1');
s1.readAloud = `The Banshee drops out of hyperspace into the amber light of Bespin. Cloud City rises ahead — not the polished resort it will become a generation from now, but a 15 BBY mining boomtown of welded platforms, rust streaks, and running lights that haven't been replaced since Vyll Beningar's grandfather built the place. Every ten seconds another atmospheric shuttle lifts off the upper landing tiers and another descends. The pre-tournament traffic the Message to Spacers warned you about is real.

Civilian docking bay 327 is your assigned berth. The approach lane is slow and theatrical — designed to show off the city to anyone with the credits to come this far.`;

s1.gmNotes = `Three-beat scene. Beat 1 establishes the city's two campaign-defining rules (credits move everything; lethal weapons stay on the ship). Beat 2 is the investigation work-beat — all five existing disciplineChallenges live here. Beat 3 fires the unsigned threat message on a ~90-minute fictional timer (or earlier if Maya's Marker safety net is pulled). The wall of silence is the scene's POINT, not its obstacle — the threat message is the resolution, not the failure case.

Existing disciplineChallenges block is unchanged and remains canonical. Beat gmNotes reference each challenge by ID (sc-a3s1-*) and indicate which beat it's live in. Top-level read-aloud above is the scene-set; each beat carries its own read-aloud.

VARTH'S ROLE: 'Man in the Chair' from the Banshee — measured, dry, complete sentences, gets quieter when angry. Voice-overs in every beat. He's already done the prep work the heroes don't see (wired the customs bribe, queued the spaceport-slice intel, has a list of contacts to suggest). The team is competent because Varth makes them look competent.

Hand off to adv3-p1-s2 (The Industrial Connection) the moment the table heads for the lift after Beat 3.`;

s1.beats = [
  {
    id: 'adv3-p1-s1-b1',
    number: 1,
    title: 'Approach & Customs',
    readAloud: `Civilian docking bay 327 is small, well-lit, and entirely full of strangers in uniform. Three Cloud City customs officers wait at the boarding clamps the moment the ramp lowers — courteous, well-dressed, and absolutely unwilling to release the Banshee until the ship is searched. Their leader, a tired human woman with a lieutenant's bar on her collar, recites the words she has clearly recited four hundred times this week: "By order of Cloud City Spaceport Authority and the Cloud City Wing Guard, we are obligated to inspect inbound vessels for contraband, undeclared weapons, and unregistered passengers. Please cooperate. The process takes approximately ninety minutes."

Behind her, mounted on the bay wall in Basic, Bocce, and Ugnaught script: NO LETHAL WEAPONS BEYOND THIS POINT. KNIVES AND STUN BATONS PERMITTED. VIOLATION: CONFISCATION + EXPULSION FROM CLOUD CITY.

Varth's voice resolves on the private comm — already three steps ahead, already amused:

"Varga ran from Takodana the night you breached the fortress at Blackwind Point. The Glorious Chariot — his yacht, the one you watched lift off Maz's lake — pinged Cloud City spaceport sixteen days ago. Nothing's docked under that registry since. He's here. He's deep. I've already wired the lieutenant's office fifteen hundred credits to waive the inspection — she'll find it in her department's discretionary account before she finishes pretending to scan the manifest. The weapons restriction, however, is real and is enforced. Leave the heavy gear on the ship or hide it well. Wing Guard catches you with a long-arm in the main concourse and you're on a freighter to Anoat by sundown."`,
    gmNotes: `Set the city's two campaign-defining rules cleanly:
  1. CREDITS MOVE EVERYTHING — Varth pre-pays the customs bribe so the table doesn't have to roll for a non-decision. Establish this as the modern adv3 voice (the team is competent because their handler is competent).
  2. LETHAL WEAPONS STAY ON THE BANSHEE — knives and stun batons are fine in main thoroughfares; anything bigger has to be hidden or left behind. This rule binds adv3-p2-s4 (Final Table) — every player needs to know it NOW so the casino-floor weapons restriction reads as setup, not arbitrary GM fiat.

NO DICE in this beat. If a PC volunteers to negotiate the bribe themselves rather than letting Varth handle it, run sc-a3s1-charm (Presence/interact, R3/P3) live and treat the Fleeting tier as "you saved Varth a thousand credits." Otherwise narrate Varth's wire transfer; the customs lieutenant pockets a discreet datachit and waves the Banshee through with apologies for the inconvenience.

If players try to smuggle weapons past customs anyway, that's their choice — narrate the customs scan as routine and let them attempt to hide the weapons (Stealth or Deception at GM's discretion, R3/P3). Discovery means confiscation of that weapon and a noted violation against the offending PC's name in the Wing Guard system; multiple violations during the adventure trigger expulsion at the worst possible moment in adv3-p2.

Hand off to Beat 2 the moment the customs party leaves the bay and the crew steps out into Cloud City proper.`,
    beatType: 'narrative',
    optional: false
  },
  {
    id: 'adv3-p1-s1-b2',
    number: 2,
    title: 'A Wall of Silence',
    readAloud: `Outside the docking bay, Cloud City unfolds. Wide promenades polished to a mirror shine, fog-glassed lifts threading between platforms, Wing Guards in white-and-blue stationed every fifty meters with stun batons clipped to their belts and carbines slung at parade-rest. The crowds are thick: prospectors arguing exchange rates with currency-exchange droids, finely dressed offworlders trailing protocol droids of their own, Ugnaughts moving in tight defensive packs that everyone else pointedly ignores. Every cantina is full. Every hotel marquee reads NO VACANCY. Every street has someone selling commemorative Sabacc Tournament chips that will be worthless in a week.

You start asking about Varga. The answers don't vary. Bartenders pour drinks without comment and find reasons to be elsewhere when the conversation shifts. A Devaronian fixer who would normally name his price for the right question waves you off mid-sentence and pays his own tab on the way out the door. A spaceport tech who almost says something thinks better of it and walks away. By the third hour, the pattern is unmistakable. This is not "I don't know." This is won't say.

Varth on comm, dry as paper:

"That's bribed silence. A different problem from honest ignorance, and a more solvable one. Two angles. One: Cloud City's spaceport logs run through a Wing Guard security post on Platform Twelve — slice in from there and you can pull the Glorious Chariot's docking record, if it still exists. Two: work the corners. Somebody on this rock hates Varga more than they fear him. Find them."`,
    gmNotes: `THIS IS THE SCENE'S MAIN WORK-BEAT. All five existing disciplineChallenges are live here.

LIVE CHALLENGES (existing block, unchanged — just slotted into this beat):
• sc-a3s1-investigation (Wits/assess, R3, P3) — slicing the Wing Guard terminal at Platform Twelve. Fleeting tier surfaces the Glorious Chariot's logged port of origin (Takodana) and confirms it docked sixteen days ago with all subsequent docking-bay records erased. Masterful narrows to a Parliament of Guilds terminal as the source of the data tampering. Legendary names Fyren as the Ugnaught who ran the erasure script.
• sc-a3s1-charm (Presence/interact, R3, P3) — bartenders, fixers, off-duty riggers. Masterful gets Fyren and Krygg by name; Legendary adds shift schedule and Maintenance Bay Seven as the meeting location.
• sc-a3s1-stealth (Reflex/interact, R3, P4) — moving through informant-laced corridors clean. Masterful clocks two Varga informants and lets the crew avoid them; Legendary maps the entire informant network on the tourist level.
• sc-a3s1-deception (Presence/interact, R2, P3) — building a tourist or prospector cover the Wing Guard accepts. Useful as protection while running the other checks.

WINS OR LOSSES BOTH LEAD TO BEAT 3. The wall is the scene's POINT. Failed checks burn fictional time without intel; succeeded checks earn the warm contact (off-duty rigger willing to whisper "Try the Works. The Ugnaughts have a problem too.") and accelerate Beat 3's read-aloud (the trace will be cleaner because they're already pointed in the right direction).

GM SAFETY NET — "Maya's Marker" (OPT-IN, NARRATIVE ONLY, NO DICE): If the table is going in circles, OR 30+ real minutes have passed without forward motion toward Beat 3, the GM may fire this safety net. Maya pings on private comm: "I've got a marker I can pull. There's an Ugnaught in The Works named Krygg — I ran a Kessel run for him three years back, the kind of run he should not have asked me to make and I should not have said yes to. He owes me, deep. I haven't pulled this one in three years and I'd rather not, but if you all are stuck up there, I make the call and we get a name and a place out of him by the time you finish your drinks. Your call."

PLAYER CHOICE — accept or decline:
• ACCEPT: Maya makes the call off-screen. Within ten in-fiction minutes, she comes back on comm with: "Krygg. The Works. Maintenance Bay Seven. He says come quiet, come in twos, and come now." The crew now has a confirmed lead. The Beat 3 unsigned message STILL fires on its ~90-minute timer — when it lands, the crew gets two converging confirmations pointing at the same place (Krygg's name + the Ugnaught-cadence linguistic read), which lets Beat 3 read as confirmation rather than revelation.
• DECLINE: Beat 3 fires as written. Maya does not push. The marker stays unpulled (and remains available later in the campaign as a one-time GM tool — note this in the campaign log).

This safety net does NOT replace or short-circuit the existing Charm/Insight/Investigation paths to the Ugnaught lead — those remain active throughout. It is an opt-in narrative escape hatch for a stalled table, not a parallel solution path. No dice. No Resist. The cost is fictional only (Maya burns a personal favor she would rather have kept).`,
    beatType: 'challenge',
    optional: false
  },
  {
    id: 'adv3-p1-s1-b3',
    number: 3,
    title: 'The Threat',
    readAloud: `Datapads chirp in unison — every member of the crew, the same instant. The message has no header, no sender, no signature. Six lines of plain text:

"Stop digging. The drop is long, and the gas pressure is high. Go home."

That's all. No demands, no follow-up, no signature.

The Banshee's astromech traces the routing the moment Maya forwards her copy: three commercial proxies, two of them legitimate Cloud City forwarders, the third a public terminal in an industrial sub-level. SECTOR U357 — PARLIAMENT OF GUILDS — ADMINISTRATIVE.

Maya pulls up the city map on the comm channel and drops a marker: two transit-lift transfers and a long walk down through warehousing, refining, and waste-recovery to get to the door.

Varth, warmer now — almost relieved:

"That's not a threat. That's somebody terrified you'll lead Varga to them. People who want you dead don't write. Go down there and say hello. Quietly. And take the long way — every Wing Guard between you and Sector U357 will remember a heavily armed party heading for The Works."`,
    gmNotes: `This beat fires on the natural ~90-minute fictional timer regardless of what the table accomplished in Beat 2 (or earlier if Maya's Marker was pulled — see Beat 2 gmNotes).

The message text is verbatim and non-negotiable. The trace is automatic — the astromech runs it, no roll required, the result is always the same Sector U357 destination. This is the scene's exit ramp, not a puzzle.

LIVE CHALLENGE (optional):
• sc-a3s1-insight (Presence/assess, R2, P2, OPTIONAL) for any PC who wants to read the message itself. Fleeting tier: "scared, not hostile." Masterful tier: "cry for help disguised as a warning." Legendary tier: identifies the sender as an educated Ugnaught using formal Basic grammar with one translated Ugnaught idiom — "the gas pressure is high" is an Ugnaught labor expression for "people are watching."

Hand off to adv3-p1-s2 (The Industrial Connection) the moment the table heads for the lift.`,
    beatType: 'narrative',
    optional: false
  }
];

// ============================================================================
// SCENE 2 — THE INDUSTRIAL CONNECTION (single beat, expanded read-aloud)
// ============================================================================
const s2 = byId('adv3-p1-s2');
s2.readAloud = `The descent into The Works takes three transit lifts and forty minutes. The cars get smaller at each transfer, the lighting dimmer, the air heavier with the smell of hot metal and something faintly chemical underneath. Humans thin out and Ugnaughts thicken — by the bottom transfer you're the only non-Ugnaughts in the car. The other passengers don't make eye contact. A foreman with a half-burned ear glances at your party once, grunts something that doesn't translate, and looks away.

Sector U357 is a long catwalk above a refining floor, the catwalk lined with scuffed durasteel doors marked in Ugnaught script and Basic. A small placard at the end identifies the office you want: PARLIAMENT OF GUILDS — SECTOR U357 ADMINISTRATIVE.

The door slides open at your touch. Inside: a dozen Ugnaught clerks at terminals, looking up in unison. Long silence.

Then one of them — smaller than the others, visibly shaking — grabs the sleeve of the Ugnaught beside him and squeals in panic:

"I told you they would find us! I told you! You've brought them down on us — they'll kill us all because you couldn't leave it alone — "

The second Ugnaught wrestles his coat free, exasperated rather than frightened.

"Krygg, ENOUGH. We don't know they work for the Hutt. They might be here to help."

He turns to the crew. Tired eyes, ink-stained hands, the body language of a labor administrator who has been awake for thirty hours.

"My name is Fyren. The one trying to climb inside his own jacket is Krygg. Come into my office. We have very little time, and you have already made a great deal of noise getting here."`;

s2.gmNotes = `The Krygg/Fyren character moment is the scene's hook — play it as written. Krygg = pure terror, Fyren = exhausted operator. They are not enemies; they sent the Beat 3 threat in s1 hoping to scare the heroes off precisely because they're afraid the heroes will lead Varga's enforcers right to them.

THE STAKES (Fyren delivers in his office, conversational not read-aloud — keep the table engaged with questions rather than monologue): When Varga set up shop in Cloud City eight months ago, he started bribing Ugnaught riggers inside Figg & Associates to siphon spin-sealed Tibanna gas off the official manifest. Figg noticed. They couldn't identify which Ugnaughts were on the take, so they pressured the Parliament to crack down on ALL Ugnaughts. Over eight months, Ugnaught reputation on Cloud City has collapsed — wage cuts, restricted work zones, the loss of three Guild seats on the city council. Fyren and Krygg are watching their community get strangled for crimes a handful of bribed riggers committed. They want it stopped. This is WHY they're risking the contact, not just what.

THE TRADE (Fyren's offer): The Parliament has tracked Varga's most recent siphon operation to Refinery Platform 13. There is a shipment going out within the hour. If the heroes stop it — Fyren is careful to say they don't insist the corrupt riggers be killed, but neither will they mourn the loss — the Parliament will hand over everything they know about how Varga's payment from the Empire is being routed through the Cloud City Sabacc Tournament.

LIVE DISCIPLINE CHALLENGES (existing block, unchanged):
• sc-a3s2-persuasion — convincing Fyren the heroes can be trusted with the operational intel up front (he holds back the tournament details until the deed is done unless he's sold hard).
• sc-a3s2-insight — reading whether Fyren is hiding more than the reputation collapse (he is not — what you see is what you get; the Empire connection is real, the Ugnaughts know it, they want help).
• sc-a3s2-investigation — pulling Parliament records to corroborate the reputation-collapse story; useful as a relationship-builder, not a gate.
• sc-a3s2-charm — winning over the room of clerks rather than just Fyren and Krygg; Legendary tier earns a quiet word from a Sullustan clerk that the corrupt rigger boss at Refinery 13 is named Greel Trask, has a wife and two children, and "would fold if cornered." This intel feeds the s3 parley path directly.

Hand off to adv3-p1-s3 (The Refinery Rumble) once the deal is struck. Krygg will follow the heroes to the lift, wringing his hands, and mumble blessings in Ugnaught at their backs as the doors close.`;

// ============================================================================
// SCENE 3 — THE REFINERY RUMBLE (3 beats, parley restored)
// ============================================================================
const s3 = byId('adv3-p1-s3');
s3.readAloud = `Refinery Platform 13 hangs three kilometers below the main city, suspended by atmospheric repulsors in the gas giant's roiling cloud band. The transit pod ride down takes nine minutes through alternating bands of amber and bruised purple cloud, the platform's running lights barely visible until you're a hundred meters out. The wind is a continuous low howl across exposed catwalks — not violent, but constant, the kind of sound that makes conversation a chore inside the first hour.`;

s3.gmNotes = `Three-beat scene. Beat 1 is recon (intel-gathering checks live). Beat 2 forks into STRIKE or PARLEY based on the table's choice — both branches converge at Beat 3. Beat 3 is the Shackles of Nizon reveal — the most important narrative beat in p1, plants the seed Maya will detonate in adv3-p2-s2.

PARLEY PATH: Restored from the DoD original. The corrupt rigger boss Greel Trask (named in s2 if the table earned the Sullustan clerk's tip) is genuinely terrified — he took the bribe eight months ago for his family and has been living with the cost. He'll surrender in exchange for safe passage off Cloud City. The Trandoshan mercenaries he hired don't care about Ugnaught politics — once Trask folds and stops paying, they'll lift off rather than die for an Ugnaught who won't honor the contract.

STRIKE PATH: Runs the existing combat encounter exactly as designed — see encounters block. Trandoshan mercenaries plus corrupt Ugnaught riggers, catwalk terrain, environmental hazards (rupture splash zones, steam pipes).

VARTH'S ROLE: Coordinates from the Banshee. Updates the team on the loading progress every two minutes during Beat 1 (creates time pressure). Goes silent during combat (Beat 2 STRIKE). Re-engages at Beat 3 for the Shackles read — and his careful word-choice when Maya asks the slave-ship question is THE moment that flags him to attentive players.

MAYA'S ROLE: Quiet through Beats 1-2. Speaks at Beat 3, reading the manifest. HER LINE IS VERBATIM AND NON-NEGOTIABLE — the campaign hinges on the players hearing her ask the question.`;

s3.beats = [
  {
    id: 'adv3-p1-s3-b1',
    number: 1,
    title: 'Approach',
    readAloud: `The platform is a flattened octagon roughly the size of a freighter pad. Four storage tanks the size of housing blocks ring the perimeter. A short-haul YT-class shuttle is parked center-platform, its cargo ramp down and its crew ramp up. Worker-class spotlights light the loading area in hard white. From your approach angle on the catwalk, you can see figures moving in and out of the spotlight — not many, maybe eight or nine total — loading slim metal canisters onto the shuttle.

The wind covers most sound. A man could shout from twenty meters and you wouldn't hear it.

Varth's voice, low:

"That shuttle's a YT-class haul. Holds maybe thirty canisters, tops. They're loading number twelve as you watch. You've got time, but not much. Decide your approach now — once those canisters are aboard and the ramp closes, the shipment lifts off and we lose this."`,
    gmNotes: `RECON BEAT. Two existing checks live here:

• sc-a3s3-stealth (Reflex/interact) — getting closer without being clocked. Masterful tier reveals the rigger boss (an Ugnaught named Greel Trask, named in s2 if the Sullustan clerk's tip was earned) standing apart from the Trandoshans, on a comm. Legendary tier overhears his half of the conversation: he's complaining that the Trandoshans want double-rate combat pay, and he doesn't have authorization for it from his Hutt contact.
• sc-a3s3-investigation (Wits/assess) — reading the manifest stencils on the canisters being loaded. Masterful confirms military-grade gas pressure ratings (consistent with weapons-system feed lines, not civilian heating). Legendary identifies the destination tag — bound for an Imperial bulk freighter currently in low Bespin orbit.

Both checks inform the Beat 2 choice. The Stealth Masterful/Legendary results in particular let the table know that Trask is buyable. The Investigation Legendary primes the players for the Beat 3 reveal so it doesn't come out of nowhere.

After the recon checks, hand the table the explicit choice: STRIKE or PARLEY. Do not let it ambiguously slide into combat. Make them pick.`,
    beatType: 'challenge',
    optional: false
  },
  {
    id: 'adv3-p1-s3-b2-strike',
    number: 2,
    title: 'Strike',
    readAloud: `You move on the loading area. The first Trandoshan to spot you raises a slug carbine and roars something in Dosh that doesn't need translation. Greel Trask drops into a service hatch and slams it behind him. The other Ugnaught riggers scatter for cover behind canisters. Three Trandoshans fan out across the catwalks, and the one nearest the shuttle ramp flips a switch on the cargo lift — locking the shuttle in place. They mean to hold the platform.`,
    gmNotes: `STRIKE BRANCH. Runs the existing combat encounter exactly as designed in the encounters block. Trandoshan mercenaries plus 2-3 corrupt Ugnaught riggers, catwalk terrain, environmental hazards live (gas-tank rupture splash zones, steam-pipe scald damage).

LIVE CHALLENGES:
• sc-a3s3-ranged — combat checks during the firefight.
• sc-a3s3-athletics — catwalk traversal, dodging splash zones, leaping the cargo gap to the shuttle.
• sc-a3s3-tech — disabling the cargo lift to trap the shuttle on the platform; or hot-wiring it to launch the shuttle EMPTY into the cloud band as a denial action if combat goes badly.

Greel Trask is in a service hatch under the platform — if pursued AFTER the Trandoshans are dealt with, he surrenders immediately, on his knees, citing his wife and children. Treat his datapad as the source of the Beat 3 manifest reveal in this branch.

Converges at Beat 3 the moment the platform is secured.`,
    beatType: 'combat',
    optional: true
  },
  {
    id: 'adv3-p1-s3-b2-parley',
    number: 2,
    title: 'Parley',
    readAloud: `You step into the spotlight with hands visible and the Ugnaught rigger boss's name on your tongue. The Trandoshan nearest the ramp brings his carbine up reflexively but doesn't fire. Greel Trask freezes. He's mid-thirties for an Ugnaught, scar across the bridge of his snout, wearing a foreman's harness over street clothes that don't match.

His eyes flick from your party to the Trandoshans to the cargo shuttle and back. He says, in Basic with a thick Ugnaught accent:

"Whatever the Parliament is paying you, I will double it. In credits. Right now. Off the books. I have a wife. Two children. I never wanted any of this. Please."`,
    gmNotes: `PARLEY BRANCH. Trask is genuinely terrified. The bribe eight months ago was a one-time decision he has been paying for ever since — Varga's enforcers visit his apartment monthly to "remind" him of his obligations, his wife stopped sleeping six weeks ago, his elder daughter has started asking questions he can't answer.

Trask will surrender the entire shipment AND the operational details (every bribed rigger's name, every drop schedule for the next thirty days, the comm-handle of his Imperial contact) in exchange for safe passage off Cloud City for himself and his family. The Parliament can grant this — Fyren has the authority and will honor the deal if the heroes confirm Trask's family will be relocated cleanly.

THE TRANDOSHANS ARE MERCENARIES. Once Trask folds and stops paying them, they'll fade back to their shuttle and lift off rather than die for an Ugnaught who won't honor the contract. NO DICE on the Trandoshan walk-off — it's narrative if the parley with Trask succeeds.

LIVE CHALLENGE (Trask's surrender):
• sc-a3s2-persuasion (re-used from s2) OR sc-a3s1-charm (re-used from s1) at R3/P3 — the GM picks based on which discipline the PC's pitch leans on. The lever is Trask's wife-and-children fear, not credits or threats.
• Failure on the parley check → Trask panics, triggers the alarm, and the STRIKE branch begins as written, with Trask's panic granting the Trandoshans one free round of action before the heroes can act.

If parley succeeds, Trask hands his datapad to the heroes voluntarily. The Beat 3 manifest reveal happens immediately — no body to search.

Converges at Beat 3.`,
    beatType: 'social',
    optional: true
  },
  {
    id: 'adv3-p1-s3-b3',
    number: 3,
    title: 'The Datapad',
    readAloud: `The platform is yours — combat-quiet or trade-quiet, depending on how the last twenty minutes went. The shuttle sits on its ramp, half-loaded. Twelve canisters stenciled with military pressure ratings are aboard; twenty-three more are still chained in the bay. Whatever the Empire was supposed to receive in this run, it's not getting it.

On the platform foreman's body — or in Greel Trask's surrendered datapad, depending on your route — you find the manifest. The destination tag isn't a unit. It isn't a quartermaster. It isn't an Imperial fuel depot. It's a single ship name, repeated on every canister:

SHACKLES OF NIZON — BULK CARRIER — IMPERIAL NAVY — LOW BESPIN ORBIT.

Maya's voice on comm. Quiet:

"That's a slave ship. The Shackles class are converted bulk haulers — they don't need armed guards because the cargo is in chains. Why is the Empire sending weapons-grade Tibanna gas to a slave transport?"

A long pause. Then Varth, careful, choosing his words:

"That's a question for later. We have what we came for. Get back to the lift. The Ugnaughts owe us a tournament briefing."`,
    gmNotes: `THE SHACKLES OF NIZON REVEAL is the most important narrative beat in p1. It plants the seed Maya will detonate in adv3-p2-s2 and act on alone in adv3-p3 (per campaign-bible.md "Maya's silence about the slave ship" / "Maya's fate is optional").

LIVE CHALLENGE (one final use of s3's investigation):
• sc-a3s3-investigation lives here ONE LAST TIME for any PC who wants to dig deeper. Fleeting tier confirms the destination tag and the orbital position. Masterful tier pulls the Shackles' last seven port calls (every one a slave-trade hub — Kessel, Klatooine, the Gozanti exchange at Sriluur). Legendary tier finds a passenger manifest fragment — three hundred and eighty-four numbered "units," no names, all logged as boarded at Klatooine four standard days ago. Children counted separately (sixty-one).

DELIVER MAYA'S LINE VERBATIM. The campaign hinges on the players hearing her ask the question. Her tone is not horrified — it's clinical. The horror is what she is NOT saying.

DELIVER VARTH'S DEFLECTION VERBATIM. He knows what the Shackles is. He is choosing to wait. Players who notice — particularly anyone running an Insight check unprompted — should be told privately: "Varth's voice was different on that line. Not warmer. Not colder. Just careful, the way a man speaks when he's choosing each word." Note Varth's deflection in the campaign log. This is foreshadowing for adv3-p3 and beyond.

Hand off to adv3-p1-s4 (The Imperial Mark) when the lift starts climbing back to Cloud City proper.`,
    beatType: 'narrative',
    optional: false
  }
];

// ============================================================================
// SCENE 4 — THE IMPERIAL MARK (4 beats, full rebuild)
// ============================================================================
const s4 = byId('adv3-p1-s4');
s4.readAloud = `The lift back from The Works takes the same forty minutes the descent took, in reverse. Nobody speaks much. The Shackles of Nizon manifest sits on three of the crew's datapads, the destination tag glowing in the reader-light: a slave ship in low Bespin orbit, expecting weapons-grade Tibanna gas it will not receive.

By the time you reach Sector U357 again, Fyren is already waiting for you in his office. He has been waiting, you suspect, since the moment the lift began to climb.`;

s4.gmNotes = `Four-beat scene — the role-assignment scene that the Tournament Tracker UI's ttroster panel binds to. This is the WORST-OFFENDER scene from the original prose — gmNotes used to just say "WALK THE TABLE THROUGH THE FOUR ENTRY PATHS." Now structured as:

  Beat 1 — The Ugnaughts Pay In Full (Fyren delivers the briefing; the entire courier-laundering mechanism is explained)
  Beat 2 — The Lobby (the Yerith Bespin tableau; tiered Investigation/Insight reveals Arandis and his entourage)
  Beat 3 — Marking the Bagman (Varth's tactical brief on what Arandis will actually do at the table)
  Beat 4 — Choosing Your Angle (the four entry paths, with each one tied to a specific action against Arandis)

The existing five disciplineChallenges (sc-a3s4-investigation, -deception, -stealth, -tech, -insight) are slotted into beats 2 and 3.

PRESERVE THE INTENT of the original gmNotes ("Multiple PCs may take different paths within the same tournament — the menu is designed to support a party split. Read the four options to the table together so the choice is informed.") — restated in Beat 4 with concrete linkages between each path and what it lets you DO about Arandis.

The Tournament Tracker UI ttroster panel binds to Beat 4. Each PC's role declaration persists into the panel's roster blob and surfaces at adv3-p2-s1.`;

s4.beats = [
  {
    id: 'adv3-p1-s4-b1',
    number: 1,
    title: 'The Ugnaughts Pay In Full',
    readAloud: `Fyren receives you in the same cramped office as before. He looks slightly older than he did six hours ago. Krygg pours water from a chipped enamel pitcher. No one sits.

Fyren keeps his end of the bargain. Eight months of Parliament intelligence, spread across his desk in printed sheets because he doesn't trust the Cloud City data network for this conversation:

The Empire is paying Varga for something. They have been paying for nine months. The payments do not run through Imperial ledgers — they run through a single courier who carries the credits, in transferable hard-currency wafers, to a public-facing commercial venue and loses them at gambling. A predesignated winner at the same table collects. The losses are written off as recreational expenditure on the courier's officer ledger. The Empire's books stay clean. Varga's proxy walks away with hard credits.

The next handover, Fyren tells you, is the Cloud City Sabacc Tournament. Three days from now.

"Start with the Yerith Bespin Hotel. The Royal Casino is sealed for tournament prep — half the Wing Guard is standing watch on the doors, you won't get within fifty meters until the tournament opens. The Yerith is where the courier and his entourage stay. Watch the lobby. You will know him when you see him."`,
    gmNotes: `Pure exposition beat. NO DICE. Fyren delivers the briefing because he owes the heroes a debt — let him talk uninterrupted unless players actively interrupt with questions, in which case answer them in his voice.

THE COURIER LAUNDERING MECHANISM is the entire thesis of part 2 — make sure every PC understands it before moving on. If the table seems unclear, have Krygg ask a clarifying question and let Fyren patiently answer:
  Q: "Why don't they just transfer the credits directly?"
  A: "Because Imperial credit transfers leave records, and this transaction does not exist."
  Q: "How does the proxy know to win?"
  A: "The courier and the proxy do not need to know each other. The courier loses on schedule. Whoever is at his table when the schedule executes is the winner. Varga's proxy is at every table the courier sits at. The math works itself out."

Fyren does NOT know the courier's name yet — that's Beat 2's discovery. He knows only that the courier will be at the Yerith Bespin and that the tournament is the venue.

The Royal Casino is closed; the Yerith Bespin is the lead. Hand off to Beat 2 the moment the table leaves Sector U357. Krygg, again, will follow them to the lift wringing his hands.`,
    beatType: 'narrative',
    optional: false
  },
  {
    id: 'adv3-p1-s4-b2',
    number: 2,
    title: 'The Lobby',
    readAloud: `The Yerith Bespin's lobby is the kind of space that announces its budget without trying. Carrara-pattern carpet woven through with platinum thread; floating crystal chandeliers held aloft by repulsor pads so quiet you have to look up to confirm they're working; a check-in counter of polished red wood manned by six staff in matched livery. The clientele is dressed for it — Core nobles, corporate princes, the very rich pretending to be incognito.

A scene is already underway at the counter. A human male in his fifties, dressed in mid-Core noble fashion, is berating a clerk at sustained volume — something about his suite, the wine in his suite, and the temperature of the wine in his suite. The clerk is enduring it with the expression of someone whose job depends on her ability to endure it. Heads are turning. Several aren't.

Across the lobby, eight people stand in a quiet cluster waiting for the noble to finish. Four of them are men — middle-aged, dressed in identical dark suits, similar enough in build and bearing that you find yourself looking from one face to another. Two are humanoid women — pale-skinned, with patterned hair in shades that don't occur in nature, posture relaxed but eyes never still. The remaining two are a Sullustan and a Twi'lek, both carrying datacases.

Varth, almost gentle:

"That's your courier. The shouting man. Name on the hotel registry is Lieutenant Armen Arandis — Imperial Naval Intelligence, payroll attached to Sector Group Bespin. Take a long look at his entourage before you decide your approach. The shouting is theater. Everything in that lobby right now is theater."`,
    gmNotes: `THE ESTABLISHING TABLEAU the original scene was missing. Run a tiered Investigation check (sc-a3s4-investigation, Wits/assess, R3, P3 — treat the noble + entourage as the target):

• Fleeting tier: The two humanoid (Theelin) women across the lobby aren't entourage. They're scanning the room methodically. Bodyguards.
• Masterful tier: The four "retainers" in matched suits are similar enough in face and frame to be siblings. Closer attention reveals they're identical past the differences a hard life writes — old scars, broken noses set at slightly different angles. Same genetic stock.
• Legendary tier: The four are clones — old-pattern, the same template the Republic's Grand Army drew from. They moved to private security after Order 66; this kind of work pays them better than the Empire's pension would. Treat as a Galactic Lore freebie if the Investigation result lands at Legendary.

If no one rolls Investigation, fall back to Insight (sc-a3s4-insight, Presence/assess, R2, P2) reading the shouting itself:
• Fleeting: The noble is angry but the staff he's berating isn't actually trying to defuse him, like they've been told to absorb it.
• Masterful: The entire scene is a delay tactic, designed to occupy lobby attention while the entourage observes who else is in the room.
• Legendary: Arandis is checking faces against a list, and you saw his eyes pass over you exactly once before sliding away.

After Beat 2, the table knows: the courier is Arandis, his "bodyguards" are professional Theelin operators, his "retainers" are clones. Hand off to Beat 3.`,
    beatType: 'challenge',
    optional: false
  },
  {
    id: 'adv3-p1-s4-b3',
    number: 3,
    title: 'Marking the Bagman',
    readAloud: `The argument at the counter resolves — abruptly, as scripted theater does. Arandis nods curtly, the clerk produces a fresh keycard, and the noble strides away from the counter with his entourage falling in around him in a loose protective formation. They take the lift to the upper floors. The lobby returns to its quiet murmur within ninety seconds, as though nothing happened.

You retreat to the lobby bar — a curved length of black stone tended by a Bothan in a cream tunic — and order drinks while Varth's voice resolves what you just watched:

"Arandis is a mathematician. Specifically, an officer of the Imperial Naval Intelligence accounting branch. He memorizes pip values to seven decimal places. At a sabacc table, he can lose a precise amount of money over a precise number of hands without ever appearing to throw the game — every loss looks like statistical noise. That is the entire skill set the Empire is paying him for. He is here to lose two hundred and fifty thousand credits to a designated winner over the course of the tournament. Your job is to either be the designated winner, or be in a position to know who is — the moment the wafer changes hands."`,
    gmNotes: `This beat sets the player objective in concrete terms. The mechanism (Arandis loses on a schedule, proxy collects, wafer changes hands) is now fully on the table. NO DICE for the briefing itself.

OPTIONAL CHALLENGES live for any PC who wants to push further:

• sc-a3s4-stealth (Reflex/interact) — following Arandis's entourage from the lobby to the upper floor and clocking his suite number. Fleeting tier identifies the floor (twenty-second). Masterful tier identifies the suite (2207, the Bespin Sky Suite — the hotel's largest). Legendary tier confirms the entourage's room assignments (clones in 2206 and 2208 flanking, Theelin bodyguards inside the suite proper, Arandis in the master bedroom; Sullustan and Twi'lek aides in 2205 across the corridor). This intel feeds the SECURITY entry path in Beat 4 and any infiltration of the suite during adv3-p2.

• sc-a3s4-tech (Wits/interact) — slicing the Yerith Bespin guest network from the lobby. The hotel's WAP is unsecured for guests but the staff network requires authentication. Fleeting confirms Arandis's group has booked through Friday. Masterful pulls his itinerary (every meal, every spa appointment, every casino slot — including a private viewing of the Royal Casino's tournament floor on Thursday afternoon). Legendary recovers a draft message from Arandis's hotel terminal to an unspecified Imperial recipient: "Asset arrived. Window is firm. Loss schedule attached."

• sc-a3s4-deception (Presence/interact) — chatting up the Yerith Bespin staff under cover (concierge, bell staff, valet) for soft intel. Useful for the Spectator entry path (cover legitimacy at the Royal Casino's public gallery).

Hand off to Beat 4 once the table is satisfied with their intelligence picture. There is no hard gate — but if every PC has skipped the optional checks, prompt: "Anyone want to take a closer look at Arandis or his suite before we talk about getting you into the tournament?"`,
    beatType: 'challenge',
    optional: false
  },
  {
    id: 'adv3-p1-s4-b4',
    number: 4,
    title: 'Choosing Your Angle',
    readAloud: `Maya's voice cuts across the comm, brisk:

"Okay. We've got him. Tournament starts in seventy-two hours. The Royal Casino opens its registration window at noon tomorrow. We need to decide how each of you gets through that door — because once you're inside, every entrance has its own footprint, its own permissions, and its own way to put hands on Arandis's wafer when it moves."

She pulls up a four-quadrant brief on every crew datapad:

  COMPETITOR  ·  SECURITY  ·  SPECTATOR  ·  DIRTY MONEY

Varth, weighing in from the ship:

"Pick the angle that fits you. There is no wrong answer. We can field two of you in one role and one each in two others — the casino floor is large enough to hide six familiar faces if they aren't standing together. Talk it through. You have until noon tomorrow to commit."`,
    gmNotes: `THIS IS THE ROLE-ASSIGNMENT BEAT — the Tournament Tracker UI ttroster panel binds here. Walk the table through the four entry paths and what each one DOES against Arandis specifically. Multiple PCs may take different paths within the same tournament; the menu is designed to support a party split. Read the four options to the table together so the choice is informed.

COMPETITOR (10,000 credit buy-in, auto-charged via the tracker):
A seat at the tournament. By Day 2 the field will narrow to the point where Arandis's table is identifiable. Direct line of sight on the wafer when it moves at the Final Table. Best for any PC with sabacc skill, gambling cover, or the credits to burn. Buy-back-in available at 2,000 credits if eliminated mid-Day 1.

SECURITY (free, requires Mandelbrot pitch):
Hired into Jacc Mandelbrot's house security team. Access to the casino's back-of-house, security feeds, and — critically — a justifiable reason to sweep Arandis's hotel suite during play (Mandelbrot's contract gives him search authority over registered competitors' rooms during the tournament for cheating-prevention purposes). Best for any PC with Stealth, Tech, or a credible intimidation profile. Surfaces the cheater-catch beat in adv3-p2-s1 (Creeska the Rodian).

SPECTATOR (free, requires invitation cover):
The casino's gallery seats overlook every felt. Permitted to circulate, photograph the action for the Holonet sports feed, and sit close enough to read facial tells. Best for any PC with Insight, social-engineering skill, or a press-credential cover. Spectators are the only role allowed to carry recording gear onto the floor — useful when the wafer transfer happens in plain sight.

DIRTY MONEY (free, but conditional):
Switch (the Bothan fixer the crew met previously, now operating a Cloud City satellite office) approaches one PC with a side contract: 5,000 credits up front to ensure that a specific Twi'lek competitor named Koroma Moro wins the tournament. Switch will not say who wants Moro to win, only that the contract is firm and the payout doubles if Moro wins clean. This is ALSO an entry path — Switch can buy any PC into a "private investor" role attached to Moro's table, with floor access in a different doorway than the other three entrances. Picking Dirty Money does NOT preclude the other entry paths for OTHER PCs — but it sets up the moral pivot that fires in adv3-p2-s3. The PC who takes Dirty Money is committing the crew to the possibility that Moro, not Arandis's proxy, wins the wafer.

PERSIST EACH PC'S ROLE in the Tournament Tracker UI ttroster panel before ending the scene. The roster blob feeds adv3-p2-s1 directly — every entry-path mechanic surfaces in the Day 1 scene based on what was selected here.

Hand off to adv3-p1-s5 (The Buy-In) once every PC's role is locked.`,
    beatType: 'narrative',
    optional: false
  }
];

// ============================================================================
// SCENE 5 — THE BUY-IN (single beat, light revision adding cover-story roll-call)
// ============================================================================
const s5 = byId('adv3-p1-s5');
s5.readAloud = `The Cloud City sun goes red over the cloud-band by 1900 local. By 2000 the crew is on the casino's mezzanine — not yet on the floor, but inside the ring, in the brick-walled administrative warren that runs behind the Royal Casino's public face. The smell up here is fresh paint and ozone from new comm gear. Tomorrow morning this corridor will be sealed.

You spend the first two hours finalizing the work of the entry-path scene: paying buy-ins where buy-ins are owed, badging in with Mandelbrot's security manager where guard slots were taken, locking down spectator covers, and — if Switch's offer was accepted in principle — opening a quiet line to a Twi'lek named Koroma Moro who will be at the table tomorrow.

At 2200 a Sullustan with sun-creased skin and a tournament organizer's pin — Jacc Mandelbrot's house manager, another Jacc by coincidence, who answers to "Jacc the Other" to keep things from getting confusing — pulls the crew into a brick-walled office off the count room. He goes around the table once before he speaks, taking each crewmember's measure and asking the same simple question:

"And you are entering as — ?"

He waits for each answer. He nods at each one. He notes none of them down — he's already been briefed, this is verification — and when the circle is closed he leans back against his desk and runs through the casino's standing rules in the flat tone of a man who has given the same briefing four hundred times.

Comm-jamming pins issued to every competitor — pinned to the lapel, active for the duration of every hand. Buy-back-in available at two thousand credits when a player gets sick mid-round, paid in advance, processed at the cage in under sixty seconds. Five named players to watch — three of them long-standing tournament veterans, one a first-year wildcard, one (he says with a particular flatness) a player whose previous tournament appearances have ended in disputes. Three exits from the casino floor. All three close on lockdown. Lockdown happens at the discretion of the house and is not, he wants to be clear, a hypothetical.

Tomorrow the doors open at standard daybreak. He shakes each crewmember's hand, wishes them a good night, and asks — politely but with weight — that they not embarrass him.

The walk back to the Banshee through the casino's emptying back corridors takes twenty minutes. Maya has the galley lit when you board. There's stew. There's caf. No one talks much.`;

s5.gmNotes = `TOURNAMENT-EVE BEAT. The Assiduous arrival has been moved out of this scene and into the new adv3-p2-s2 (Message from the Banshee), where it lands during the tournament itself with the Switch commit. This scene is now a clean preparation beat — final cover-checks, buy-in ledger, Mandelbrot security briefing, and one quiet round at a cantina or the Banshee galley if the table wants it.

NO DICE on the Mandelbrot briefing — the rules he names are mechanics that bind the next scene (comm-jamming pin, buy-back-in, named players to watch). Surface them here so the table knows them before they sit down.

THE COVER-STORY ROLL-CALL: When Jacc the Other walks the table asking each PC "And you are entering as — ?", give every PC the floor for one beat to declare their cover in their own voice. This is not a roll — it is a player-facing moment to lock in the entry path emotionally as well as mechanically. The Tournament Tracker roster panel should reflect each declaration exactly. If a PC declared Dirty Money, Jacc's nod will be a fraction slower than the others (he knows; he doesn't say so).

THE FIVE NAMED PLAYERS: Mandelbrot's "five to watch" list maps to the five named NPCs at the tournament (Lieutenant Armen Arandis, Lady Fioro, Silas Draver, Creeska the Rodian, Koroma Moro). The "previous appearances ending in disputes" line is Mandelbrot flagging Creeska as a known cheat without naming him directly — adv3-p2-s1's catch-the-cheater beat depends on this seed. Players who pay attention will register the implicit warning.

LIVE CHALLENGE (optional):
• sc-a3p1s5-charm — any PC wanting to read Jacc the Other for additional intel beyond the public briefing. Fleeting tier earns the floor map. Masterful tier confirms the lockdown procedure (six Wing Guards plus Mandelbrot's eight house security on the doors, all three exit corridors flooded with non-lethal gas at command). Legendary tier gets a personal aside — Jacc admits he has been told by Mandelbrot to keep particular eyes on Lady Fioro's table, though he will not say why.

Hand off to adv3-p2-s1 (Day 1) at standard daybreak.`;

// ============================================================================
// WRITE BACK
// ============================================================================
fs.writeFileSync(FILE, JSON.stringify(adv, null, 2) + '\n', 'utf8');
console.log('OK: rewrote adv3-p1 scenes s1..s5');
console.log('  s1: ' + s1.beats.length + ' beats added; readAloud=' + s1.readAloud.length + ' chars; gmNotes=' + s1.gmNotes.length + ' chars');
console.log('  s2: 0 beats; readAloud=' + s2.readAloud.length + ' chars; gmNotes=' + s2.gmNotes.length + ' chars');
console.log('  s3: ' + s3.beats.length + ' beats added; readAloud=' + s3.readAloud.length + ' chars; gmNotes=' + s3.gmNotes.length + ' chars');
console.log('  s4: ' + s4.beats.length + ' beats added; readAloud=' + s4.readAloud.length + ' chars; gmNotes=' + s4.gmNotes.length + ' chars');
console.log('  s5: 0 beats; readAloud=' + s5.readAloud.length + ' chars; gmNotes=' + s5.gmNotes.length + ' chars');
