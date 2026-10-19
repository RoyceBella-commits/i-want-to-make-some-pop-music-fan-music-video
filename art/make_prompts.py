"""Write one prompt JSON per keyframe (art/prompts/<id>.json) from the storyboard.

Shared style / palette / faceless rules live in style.json and are merged by gen_codex.py;
here each shot only adds what is specific to it.
"""
import json
from pathlib import Path

ART = Path(__file__).resolve().parent
CHAR = {"path": "raw/charsheet/charsheet_v1.png",
        "role": "character reference only: keep the protagonist's look (short dark bob that always hides the face, cornflower-blue shirt, mustard-yellow cable-knit sweater vest, walnut-brown trousers, teal sneakers; as a child: mustard-yellow T-shirt and teal shorts) and the flat print style; do not copy the sheet layout or poses"}
FRIEND = {"path": "raw/charsheet_friend/charsheet_friend_v1.png",
          "role": "character reference only: keep the keyboardist friend's look (tall, short curly dark-brown hair, oversized fluorescent-pink sweater, teal wide trousers, face never visible) and the flat print style; do not copy the sheet layout"}
WINDOWS = {"path": "raw/s20_windows/s20_windows_v1.png",
           "role": "reference for the family silhouettes only (the couple, and the grandparents with the small radio); keep their silhouettes and the flat print style; do not copy the composition"}

P_SUMMER = "mustard yellow (#FFB511) and cornflower blue (#62A8E5) dominant, small teal (#00838A) and walnut brown (#925F52) accents, no pink"
P_SCHOOL = "fluorescent pink (#FF48B0), mustard yellow (#FFB511) and teal (#00838A) dominant, cornflower blue (#62A8E5) and walnut brown (#925F52) supporting"
P_ROOM = "walnut brown (#925F52) wood, teal (#00838A) carpet, mustard yellow (#FFB511) and cornflower blue (#62A8E5) clothes, small fluorescent pink (#FF48B0) accents"
P_POP = "fluorescent pink (#FF48B0) and mustard yellow (#FFB511) dominant, cornflower blue (#62A8E5) accents, candy-like"
P_COLD = "teal (#00838A) and walnut brown (#925F52) dominant, cool night mood, small mustard-yellow (#FFB511) window light"
P_NIGHT = "teal (#00838A) and cornflower blue (#62A8E5) dominant night, walnut brown (#925F52) furniture, small mustard-yellow (#FFB511) lamp light"
P_WARM = "mustard yellow (#FFB511), walnut brown (#925F52) and teal (#00838A), warm and gentle, small fluorescent pink (#FF48B0) accents"
P_FULL = "all five inks: fluorescent pink (#FF48B0), mustard yellow (#FFB511), cornflower blue (#62A8E5), teal (#00838A), walnut brown (#925F52)"

SHOTS = [
    # ---- character reference for the friend (needed by later shots) ----
    dict(id="charsheet_friend", has_protagonist=False,
         asset_type="character reference sheet for a narrative music video; used as a reference image for later keyframes",
         primary_request="Character reference sheet of the protagonist's bandmate, a keyboardist friend, in the same flat print style, face never visible.",
         input_images=[CHAR],
         scene="plain warm off-white paper background, no environment",
         subject="four full-body poses of one tall young adult (the keyboardist friend) in a single row, evenly spaced: (1) seen from behind, (2) side view with head turned away and curly hair hiding the face, (3) seen from behind playing a small synthesizer keyboard on a stand, (4) three-quarter back view running and waving one arm. The friend has short curly dark-brown hair, an oversized fluorescent-pink sweater, teal wide trousers and walnut-brown boots; the face is never visible (always from behind or turned away; no eyes, nose or mouth).",
         composition="wide landscape layout, four figures in one row, generous margins",
         lighting="flat even light, simple flat shadow shapes under the figures",
         palette=P_SCHOOL,
         extra_constraints="this is a reference sheet: no labels, no captions"),

    dict(id="s03_chords", input_images=[CHAR],
         primary_request="The teenager is fed up with ordinary expression and with repeating the same four chords.",
         scene="the corner of a teenager's bedroom: a desk against a plain wall; pinned to the wall above the desk in one neat horizontal row are four identical blank cards, each showing an empty guitar chord grid (6 vertical lines, 5 horizontal lines, no dots, no letters); a desk lamp, a guitar leaning on the desk",
         subject="the same teenager from the reference sitting at the desk, seen from behind, slumped with chin on folded arms, staring at the four cards",
         composition="medium-wide shot from behind; the row of four cards is large and clearly visible in the upper middle; calm empty wall in the upper-left area for lyric text",
         lighting="flat dull afternoon light, slightly bored mood",
         palette="teal (#00838A), cornflower blue (#62A8E5) and walnut brown (#925F52) dominant, mustard yellow (#FFB511) accents, no pink"),

    dict(id="s04_form", has_protagonist=False,
         primary_request="Top-down still life: an application form on a desk, about to be stamped — the decision to change majors.",
         scene="a wooden desk seen exactly from above: in the center a single sheet of paper that looks like a form (a large empty box at the top, several empty ruled lines, two empty checkboxes, an empty signature line; absolutely no writing); a fountain pen, a round rubber stamp with its handle, an ink pad, a guitar pick and a train ticket stub lying around",
         subject="the form is the hero; its large empty area must be clean and flat so text can be printed onto it later",
         composition="perfectly top-down flat-lay; the form fills about 45% of the frame, slightly rotated; props around it",
         lighting="flat even light, soft flat shadows",
         palette=P_SUMMER.replace("no pink", "a little fluorescent pink (#FF48B0) on the stamp handle")),

    dict(id="s05_gate", input_images=[CHAR],
         primary_request="The young adult pushes open the door of the art school and bright light floods in — they start looking forward to tomorrow.",
         scene="a tall old double door being pushed open from the inside of a dim corridor; beyond the door a sunny art-school courtyard with a few abstract sculptures, potted trees and colorful posters (posters show only shapes, no text)",
         subject="the same young adult from the reference, seen from behind in the doorway with a guitar case on the back, one hand pushing the door",
         composition="symmetrical, the doorway in the center, the figure small-medium in the lower middle; strong contrast between the dark corridor (foreground) and the bright courtyard (background); empty bright sky area at the top for text",
         lighting="strong bright light pouring through the door, long flat shadow toward the viewer",
         palette=P_SCHOOL),

    dict(id="s06_scale", input_images=[CHAR],
         primary_request="Learning to enrich scales: a staircase made of piano keys that the young adult climbs.",
         scene="a surreal staircase in an airy art-school atrium: each step is a giant piano key (white keys as steps, black keys as narrow raised blocks between them), rising diagonally from lower-left to upper-right",
         subject="the same young adult from the reference, seen from behind and slightly to the side, climbing the key-steps, guitar case on the back",
         composition="wide shot, the staircase as a clear diagonal with about 9 visible steps; the figure on the lower third of the stairs; calm empty wall area in the upper-left for text",
         lighting="bright daylight, flat shadows under each step",
         palette=P_SCHOOL),

    dict(id="s07_blocks", input_images=[CHAR],
         primary_request="Learning to enrich chords: the young adult stacks big colorful building blocks into a tall tower.",
         scene="a bright studio room with a plain wall; a tower of five large plain building blocks of different colors stacked unevenly, about twice the height of a person",
         subject="the same young adult from the reference, seen from behind on a small step ladder, lifting one more block onto the top of the tower",
         composition="tall tower in the center-right; the blocks have large flat empty faces (for printed notes later); calm empty wall at the left for text",
         lighting="flat bright light",
         palette=P_SCHOOL),

    dict(id="s08_sounds", input_images=[CHAR],
         primary_request="Never defining sound: the young adult records the sounds of pots, pans, bottles and kitchenware with a studio microphone.",
         scene="a small cluttered recording booth with acoustic foam panels; a studio condenser microphone on a stand; pots, pans, glass bottles, a kettle and wooden spoons arranged like a drum kit on a table; headphones and a cable on the floor",
         subject="the same young adult from the reference, seen from behind-side with head lowered, hitting a pan with a wooden spoon toward the microphone",
         composition="medium-wide shot; the microphone clearly visible on the left-center; calm empty foam-panel wall in the upper-right for text",
         lighting="warm studio lamp light",
         palette=P_SCHOOL),

    dict(id="s09_install", input_images=[CHAR],
         primary_request="Making art works: a gallery installation made of hanging speakers and cassette tapes; the young adult stands looking at it.",
         scene="a white-walled gallery with a polished floor; from the ceiling hang dozens of small speakers and loose cassette tapes on strings, forming a cloud-like installation; a long cable runs across the floor",
         subject="the same young adult from the reference, small, seen from behind standing under the installation, looking up",
         composition="wide shot; installation fills the upper middle; the figure small at the lower center; calm empty wall area on the right for text",
         lighting="soft gallery light, clean shadows",
         palette=P_SCHOOL),

    dict(id="s10_stage", input_images=[CHAR],
         primary_request="Interactive theater and film: a small black-box theater that is also a film set; the young adult works behind a film camera.",
         scene="a black-box theater stage with a single bright spotlight circle on the floor, a simple chair in the spotlight, a film camera on a tripod in the foreground, a blank clapperboard on the floor, cables, a boom microphone",
         subject="the same young adult from the reference, seen from behind looking through the film camera toward the spotlight",
         composition="the camera and the figure in the left foreground, the spotlight circle in the right middle ground; dark surroundings; calm dark upper area for text",
         lighting="one strong spotlight, everything else dim",
         palette="teal (#00838A) and walnut brown (#925F52) dark surroundings, mustard yellow (#FFB511) spotlight, fluorescent pink (#FF48B0) accents"),

    dict(id="s11_band", input_images=[CHAR, FRIEND],
         primary_request="Forming a band and making some noise in a basement rehearsal room; the keyboardist friend appears for the first time.",
         scene="a cramped basement rehearsal room: guitar amplifier, a small drum kit, a synthesizer keyboard on a stand, the floor covered with many guitar effect pedals connected by tangled cables, a rug, a bare light bulb",
         subject="the protagonist (from Image 1) seen from behind playing an electric guitar on the left; the keyboardist friend (from Image 2) seen from behind-side playing the synthesizer on the right; both faces never visible",
         composition="wide shot; the pedals and cables fill the foreground floor; both figures in the middle ground; calm empty wall area at the top-left for text",
         lighting="warm bare-bulb light, energetic",
         palette=P_SCHOOL),

    dict(id="s12_pieces", has_protagonist=False,
         primary_request="Nobody can explain the core of the patched-together symbols: a floor scattered with fragments of all the creative work, and two hands trying to arrange them.",
         scene="a floor seen exactly from above, covered with scattered items like puzzle pieces: loose sheet music pages (staff lines with abstract note marks, no text), strips of film negative, a few bound scripts (blank covers), cassette tapes, two portable hard drives, sketches of shapes, a guitar pick",
         subject="two hands entering from the bottom of the frame, arranging the pieces (only the hands and the light-blue shirt cuffs visible)",
         composition="top-down flat-lay; items spread over the whole frame with a few gaps; a clearer empty patch of floor at the upper-left for text",
         lighting="flat even light",
         palette=P_ROOM),

    dict(id="s13_room", input_images=[CHAR],
         primary_request="After graduation: the protagonist's own small room, full of the things that formed them.",
         scene="a small room with walnut-wood wall panels and a teal carpet: a bookshelf with books, a record player with a record on a low cabinet and a stack of records, an empty picture frame on the wall (diploma-like, blank), several ticket stubs pinned to a cork board (blank), an acoustic guitar on a stand, a floor lamp, a vase of baby's breath flowers",
         subject="the same young adult from the reference sitting on the carpet in the middle, seen from behind, looking around the room",
         composition="wide shot; objects spread across the frame left to right (bookshelf left, record player center-left, frame and cork board center-right, guitar right) so the camera can pan across them; walnut wall in the upper area",
         lighting="warm lamp light",
         palette=P_ROOM),

    dict(id="s14_hands", has_protagonist=False, input_images=[CHAR],
         primary_request="Surreal: the whole small room is held up from below by several pairs of family members' hands — everything is based on the family's effort and luck.",
         scene="the small room from before (walnut panels, teal carpet, record player, guitar) shown as a tiny open-front diorama box; it rests on and is lifted by several pairs of adult hands coming from below: a mother's hands, a father's larger hands, and two pairs of older wrinkled grandparents' hands with a bracelet and a watch",
         subject="the hands and the tiny box room; inside the box a tiny figure of the protagonist from the reference (mustard-yellow cable-knit sweater vest, light-blue shirt, brown trousers) lies FACE-DOWN on the teal carpet with an open book covering the head, so no face is visible at all",
         composition="the box in the upper-middle, the hands spreading out below and toward the bottom edges; plenty of plain background around, so the camera can start close on the box and pull back to reveal the hands",
         lighting="soft warm light from above",
         palette=P_ROOM),

    dict(id="s15_cover", input_images=[CHAR],
         primary_request="Lying face-down on the carpet with an open book covering the head, secretly delighted.",
         scene="a teal carpet with walnut wood panels at the top edge of the frame; books scattered around; a vase of baby's breath flowers in a corner; a floor lamp base",
         subject="the same young adult from the reference lying face-down on the carpet with arms stretched out, an open hardcover book resting on the head and covering it completely",
         composition="seen from above at a slight angle; the figure diagonal across the middle; calm empty carpet area in the upper-left for text",
         lighting="warm soft light",
         palette=P_ROOM,
         extra_avoid="cats or animals"),

    dict(id="s17_popstage", input_images=[CHAR],
         primary_request="Wanting to make pop music: an imagined candy-colored pop stage with confetti and a big empty marquee sign.",
         scene="a glossy candy-colored pop stage: a big empty marquee sign frame with light bulbs around its border hanging above the stage (the inside of the sign is a clean flat empty panel), tall speaker stacks, confetti, star shapes, a glittering curtain",
         subject="the same young adult from the reference standing on the stage, seen from behind, holding an acoustic guitar, facing an imagined crowd",
         composition="the marquee sign large in the upper-middle (its empty inner panel about 55% of the frame width); the figure small-medium at the lower center",
         lighting="bright pop stage lights",
         palette=P_POP),

    dict(id="s18_shelf", input_images=[CHAR],
         primary_request="Wishing the market were more tolerant: a supermarket shelf full of identical pink boxes, one of which contains the tiny protagonist with a guitar.",
         scene="a long supermarket shelf in perspective with rows and rows of identical fluorescent-pink product boxes, each with a clear window; most windows show an identical tiny generic stage; one box near the center holds the tiny protagonist with a guitar",
         subject="the tiny protagonist (as in the reference) inside one box near the center, seen from behind",
         composition="the central box at the center of the frame; identical boxes repeating to all edges so the camera can pull back; no price tags, no text",
         lighting="flat bright supermarket light",
         palette=P_POP),

    dict(id="s20_windows", input_images=[CHAR],
         primary_request="Being watched: at night the apartment building across the street has a grid of windows, and in them are the silhouettes of the people who watch and wait.",
         scene="night; the facade of an old apartment building fills most of the frame with a grid of 4 columns × 3 rows of windows; inside the windows, flat silhouettes: a middle-aged couple standing side by side; an elderly grandmother in a rocking chair and a grandfather holding a small radio; two young people holding glowing phones; two silhouettes with crossed arms; the remaining windows empty; in the lower foreground, the inside edge of the protagonist's own lit window with the protagonist seen from behind sitting at a desk",
         subject="silhouettes only — flat shapes with no faces at all; the protagonist from behind",
         composition="the window grid is regular and clearly separated so each window can be lit separately later; foreground window frame at the bottom; calm dark wall area at the top for text",
         lighting="dark night; the protagonist's lamp warm in the foreground",
         palette=P_COLD),

    dict(id="s21_magnifier", has_protagonist=False,
         primary_request="Examining the work with a magnifying glass: the protagonist's demo cassette on a desk under a giant magnifying glass held by a hand from above.",
         scene="a desk surface: a cassette tape with a blank label lying on a sheet of plain paper, a pencil, headphones",
         subject="a hand coming from the top edge holding a large round magnifying glass over the cassette; the lens interior is clean and clear, showing the paper and the cassette label magnified",
         composition="the lens circle large in the center (about 40% of frame height); plain paper area around for text",
         lighting="cool desk lamp light",
         palette=P_COLD),

    dict(id="s22_mirror", input_images=[CHAR],
         primary_request="Who is the one in the mirror: a fogged bathroom mirror, the protagonist from behind; the reflection is only a blurry shape.",
         scene="a small bathroom: a large rectangular mirror above a sink, completely fogged with steam; tiles; a toothbrush cup",
         subject="the same young adult from the reference standing in front of the mirror, seen from behind; in the fogged mirror only a vague blurry silhouette, no facial features visible at all",
         composition="the mirror large in the center-upper area (a big clean fogged surface for text later); the figure from behind in the lower foreground",
         lighting="soft cool bathroom light, steam",
         palette="cornflower blue (#62A8E5) and teal (#00838A) dominant, walnut brown (#925F52) and a little mustard yellow (#FFB511)"),

    dict(id="s23_poster", has_protagonist=False,
         primary_request="Having bragged in the past: an old gig poster on a wall, half torn off.",
         scene="a weathered wall with an old gig poster showing a big guitar silhouette and starburst shapes, no text; the poster is half torn off diagonally and its torn piece curls down; other poster scraps around",
         subject="the half-torn poster",
         composition="poster center-right; plain wall area at the left for text",
         lighting="flat light",
         palette=P_COLD.replace("cool night mood, ", "")),

    dict(id="s24_dinner", has_protagonist=False,
         primary_request="'Cherish your luck,' they say: a family dinner table seen from above, hands putting food into the protagonist's bowl.",
         scene="a round wooden dinner table seen from above with home-style dishes, rice bowls, chopsticks, a teapot and cups",
         subject="three or four adult hands (one older, wrinkled) reaching in with chopsticks to put food into one bowl at the bottom of the frame; the protagonist's light-blue sleeve at the bottom edge",
         composition="top-down; the table fills the frame; a calm area of tablecloth at the upper-left for text",
         lighting="warm home light",
         palette=P_WARM),

    dict(id="s25_objects", has_protagonist=False,
         primary_request="Six things nobody cares about, laid out on a table: a dream list, a portfolio, a hand holding a rubber stamp, gig tickets with an empty tip jar, a script with a cassette, and an application form.",
         scene="a long table seen from above with six clearly separated items arranged in a 3 × 2 grid with space between them: (1) a notebook page with a doodled star and guitar (no text), (2) an open portfolio folder with sketches and film strips, (3) a hand holding a rubber stamp, (4) a few gig tickets (blank) next to an empty glass tip jar, (5) a bound script (blank cover) with a cassette tape on it, (6) a form sheet with empty boxes and lines exactly like an application form",
         subject="the six items",
         composition="top-down; even 3 × 2 grid; each item with plain table space around it",
         lighting="flat even light",
         palette=P_COLD.replace("cool night mood, ", "")),

    dict(id="s31_books", has_protagonist=False,
         primary_request="Studying philosophy and mathematics doesn't make money either: a stack of thick books next to a calculator and a ledger.",
         scene="a desk: a tall stack of thick hardcover books (blank spines), an old calculator, an open ledger with empty grid columns, a pencil, a cup of tea",
         subject="the still life",
         composition="the book stack on the left, calculator and ledger center-right; calm wall area in the upper-right for text",
         lighting="cool lamp light",
         palette=P_COLD),

    dict(id="s32_door", input_images=[CHAR],
         primary_request="Late at night, seeing how hard mother works: a dim apartment entrance with worn work shoes and a work bag just put down; the protagonist watches from a half-open door.",
         scene="a narrow apartment entrance hall at night: a pair of worn work shoes just taken off, a work bag set down on a stool, keys on a hook, a hallway light on; on the wall the long soft shadow of an adult walking away down the hall (only the shadow)",
         subject="in the foreground the edge of a half-open bedroom door and the back of the protagonist's head peeking out (from behind)",
         composition="the shoes and bag in the middle ground center; the door edge and the back of the head on the right foreground; calm dark wall in the upper-left for text",
         lighting="a single warm hallway light, quiet and tender",
         palette="teal (#00838A) and walnut brown (#925F52), a little mustard yellow (#FFB511) light, muted"),

    dict(id="s33_work", input_images=[CHAR],
         primary_request="Starting to work hard and make things to fight anxiety: late night at the desk with a laptop music program, a microphone and many cups.",
         scene="a desk by a window at night: a laptop showing a music-production screen made of colored blocks and waveforms (no text), a studio microphone, a small keyboard controller, many coffee cups and mugs accumulated, sticky notes (blank); the window shows a plain empty sky (one flat color, no clouds, so it can be recolored later)",
         subject="the same young adult from the reference at the desk, seen from behind, wearing over-ear headphones",
         composition="the window clearly visible in the upper-left; the figure center-right; calm wall area in the upper-right for text",
         lighting="screen glow and a desk lamp",
         palette=P_NIGHT),

    dict(id="s34_mic", input_images=[CHAR],
         primary_request="Stubbornly singing out loud: a close shot of the protagonist gripping a microphone and singing with all their strength.",
         scene="a simple plain background",
         subject="the same young adult from the reference in a close shot from behind and slightly to the side, both hands gripping a handheld microphone raised close, body leaning forward; the hair hides the face completely",
         composition="close-medium shot; the figure on the right half; large plain area on the left for big text",
         lighting="strong side light",
         palette="teal (#00838A), mustard yellow (#FFB511) and cornflower blue (#62A8E5), with fluorescent pink (#FF48B0) background shapes"),

    dict(id="s35_rehearsal", input_images=[CHAR, FRIEND],
         primary_request="All my relationships and connections: a rehearsal room where the protagonist, the keyboardist friend and a few friends sit together, connected by audio cables.",
         scene="a warm rehearsal room: amps, a keyboard, guitars, a drum, a sofa, a rug; many audio cables run across the floor between instruments and people; on the wall a framed family photo showing people from behind",
         subject="the protagonist (Image 1) sitting with a guitar, the keyboardist friend (Image 2) at the keyboard, and three other friends sitting on the sofa and floor; everyone seen from behind or turned away, no faces",
         composition="wide shot; five people spread from left to right; the cables clearly visible on the floor; calm wall area at the top for text",
         lighting="warm cozy light",
         palette=P_WARM),

    dict(id="s37_cover2", input_images=[CHAR],
         primary_request="Again secretly delighted, but this time not alone: the protagonist lying face-down with a book over the head, while a friend's hands tidy up books nearby.",
         scene="a teal carpet in front of walnut-wood wall panels; scattered books and records; a vase of baby's breath flowers; a floor lamp base",
         subject="the same young adult from the reference lying face-down, an open book covering the head, one arm stretched out; at the left edge a friend's hands (dark sleeve) picking up a stack of books",
         composition="seen from slightly above; the figure diagonal across the middle; calm carpet area in the upper-right for text",
         lighting="warm soft light",
         palette=P_ROOM,
         extra_avoid="cats or animals"),

    dict(id="s39_city", input_images=[CHAR],
         primary_request="Topics nobody cares about: a crowded street of identical people with identical headphones and blank billboards; the protagonist walks against the flow with a guitar case.",
         scene="a city street with tall buildings and three big blank billboards (clean flat empty panels); a crowd of identical people all wearing the same headphones, walking in one direction; colorful shop awnings and potted flowers along the street",
         subject="the same young adult from the reference walking against the crowd, seen from behind, guitar case on the back, in the center",
         composition="the protagonist center; billboards large in the upper half (for printed text later); the crowd fills the lower half",
         lighting="flat daylight",
         palette=P_FULL),

    dict(id="s41_book", input_images=[CHAR],
         primary_request="Curious about how history is built: the protagonist sits before a giant open book whose pages are a panoramic scroll of music history.",
         scene="a giant open book filling the frame horizontally; its pages show a continuous illustrated panorama from left to right: bone flutes and hand drums, a guqin and a pipa, a harpsichord, an orchestra, a gramophone, an electric guitar and amplifier, a modular synthesizer",
         subject="the same young adult from the reference small, sitting cross-legged at the bottom center in front of the book, seen from behind, looking up",
         composition="wide panorama; the history scroll spans the whole width so the camera can truck left to right; the figure small at the bottom center; calm area at the top for text",
         lighting="warm reading light",
         palette=P_FULL),

    dict(id="s42_night", input_images=[CHAR],
         primary_request="Notes flow into my ears: night, the window is open, curtains blow inward, the protagonist sits listening.",
         scene="a bedroom at night: a large open window on the left with curtains blowing inward, moon and stars outside, a bed, headphones on the bed, a guitar against the wall",
         subject="the same young adult from the reference sitting on the edge of the bed, seen from behind, head tilted toward the window as if listening",
         composition="window on the left, figure center-right; open air between the window and the figure (for flowing notes later); calm wall area in the upper-right for text",
         lighting="moonlight and a small warm lamp",
         palette=P_NIGHT),

    dict(id="s43_roof", input_images=[CHAR],
         primary_request="Breaking through: surreal — the bedroom ceiling cracks open to a starry sky, the protagonist stands on the bed reaching up.",
         scene="the same bedroom seen from a low angle; the ceiling is split open with jagged edges revealing a deep starry night sky full of stars",
         subject="the same young adult from the reference standing on the bed, seen from behind, one arm reaching up toward the opening",
         composition="low angle; the opening in the ceiling occupies the upper half; the figure lower center",
         lighting="cool starlight from above, warm lamp below",
         palette=P_FULL),

    dict(id="s44_run", input_images=[CHAR, FRIEND],
         primary_request="Cherish the lucky aesthetic experiences, throw away the complaints: at dawn the protagonist runs down outdoor street stairs with a guitar case; the keyboardist friend runs ahead and turns back to wave.",
         scene="a hillside city street with long outdoor stairs at sunrise; rooftops, power lines, the sky turning pink and yellow",
         subject="the protagonist (Image 1) running down the stairs seen from behind with a guitar case; the keyboardist friend (Image 2) further down, turned away, waving one arm; no faces",
         composition="the stairs as a strong diagonal; both figures in motion; sky area at the top for text",
         lighting="sunrise glow",
         palette="fluorescent pink (#FF48B0), mustard yellow (#FFB511) and cornflower blue (#62A8E5) dominant, teal (#00838A) and walnut brown (#925F52) shadows"),

    dict(id="s45_walls", input_images=[CHAR, FRIEND],
         primary_request="We no longer need to hold back: surreal — the four walls of the bedroom fall outward like a cardboard box opening, revealing a stage with lights all around.",
         scene="a small bedroom whose four walls are falling outward like the flaps of an opening box; beyond the falling walls a ring of stage lights, speaker stacks and a cheering crowd silhouette",
         subject="the protagonist (Image 1) with a guitar and the keyboardist friend (Image 2) with a keyboard standing in the middle of the room's floor, both seen from behind",
         composition="symmetrical; the falling walls frame the center; the duo in the middle",
         lighting="stage lights bursting in",
         palette=P_FULL),

    dict(id="s46_live", input_images=[CHAR, FRIEND],
         primary_request="I want to make some pop music, and hope everyone is a little happier: a small live house concert seen from behind the duo on stage.",
         scene="a small live house: from behind the stage looking out at a happy crowd with raised hands; colored stage lights in pink, yellow and blue; a mic stand, amps, cables",
         subject="the protagonist (Image 1) singing with a guitar and the keyboardist friend (Image 2) at a keyboard, both seen from behind; the crowd as joyful flat silhouettes",
         composition="the duo in the lower foreground left and right; the crowd across the middle; lights at the top",
         lighting="colorful concert lights",
         palette=P_FULL),

    dict(id="s47_crowd", input_images=[WINDOWS],
         primary_request="The people who once watched from the windows are now in the audience: from the stage, the back rows include the middle-aged couple and the grandparents with a small radio.",
         scene="a small live house audience seen from the stage: happy silhouettes in front with raised hands; in the back row the same family silhouettes as in Image 1 — the middle-aged couple side by side, the grandmother and the grandfather holding a small radio — standing calmly and smiling-in-pose (no faces)",
         subject="the crowd and the family silhouettes in the back row",
         composition="the family group in the upper-middle back row, clearly readable; calm area at the top for text",
         lighting="warm stage spill light on the audience",
         palette=P_FULL,
         has_protagonist=False),

    dict(id="s49_split", input_images=[CHAR],
         primary_request="I also want to make some unpopular music: a stage split down the middle — clean pop on the left, noise experiments on the right — the protagonist stands on the dividing line.",
         scene="a stage divided vertically in the middle: the left half is neat and glossy pop (pink lights, tidy mic stand, sparkles); the right half is a noise experiment (tangled cables, tape loops hanging, scattered effect pedals, contact microphones, a feedback amp)",
         subject="the same young adult from the reference standing exactly on the dividing line, seen from behind, holding an electric guitar",
         composition="symmetrical split; the figure in the center",
         lighting="pink light on the left, uneven flickering light on the right",
         palette=P_FULL),

    dict(id="s50_kid", input_images=[CHAR],
         primary_request="You can no longer live in a simple world, because you have already asked the question: in the front row of the crowd, the summer child holds the big guitar and looks up at the stage, where the grown protagonist is a backlit silhouette.",
         scene="the front edge of a small stage seen from the audience; strong stage lights behind the performer create a backlit silhouette",
         subject="in the foreground, the child from the reference (mustard-yellow T-shirt, teal shorts, short dark bob) seen from behind, hugging a guitar almost as big as them, looking up; on the stage the grown protagonist kneeling at the edge, a flat backlit silhouette leaning toward the child",
         composition="the child large in the lower-left foreground from behind; the stage silhouette upper-right; calm light area at the top-left for text",
         lighting="strong backlight from the stage",
         palette=P_FULL),
]


def main() -> None:
    out = ART / 'prompts'
    out.mkdir(exist_ok=True)
    for s in SHOTS:
        s = dict(s)
        if s.pop('extra_avoid', None) is not None:
            s['extra_avoid'] = 'cats or animals'
        (out / f"{s['id']}.json").write_text(json.dumps(s, ensure_ascii=False, indent=2))
    print(len(SHOTS), 'prompts')


if __name__ == '__main__':
    main()
