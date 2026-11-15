import { exerciseProfile } from "./exerciseProfiles";

/** Teaching diagrams, never pose-detector fixtures or a simulated camera feed.
 * Coordinates explain the sequence; they are not target angles or required range.
 * Left/right colours always name the person's anatomical side. */
export type Point = readonly [number, number];
export type Pose = {
  head: Point;
  ls: Point;
  le: Point;
  lw: Point;
  rs: Point;
  re: Point;
  rw: Point;
  lh: Point;
  lk: Point;
  la: Point;
  rh: Point;
  rk: Point;
  ra: Point;
  spine?: Point;
};
export type MotionFrame = { label: string; cue: string; pose: Pose };
export type MotionMap = {
  view: string;
  support: "floor" | "wall" | "chair" | "bench" | "rail" | "none";
  frames: MotionFrame[];
  detail?: string;
};
const pt = (x: number, y: number): Point => [x, y];
const pose = (base: Pose, patch: Partial<Pose>): Pose => ({
  ...base,
  ...patch,
});
const front: Pose = {
  head: [160, 35],
  ls: [140, 61],
  le: [130, 92],
  lw: [132, 120],
  rs: [180, 61],
  re: [190, 92],
  rw: [188, 120],
  lh: [146, 116],
  lk: [143, 153],
  la: [140, 191],
  rh: [174, 116],
  rk: [177, 153],
  ra: [180, 191],
};
const side: Pose = {
  head: [146, 33],
  ls: [147, 61],
  le: [146, 91],
  lw: [151, 117],
  rs: [139, 57],
  re: [138, 87],
  rw: [143, 113],
  lh: [149, 116],
  lk: [150, 153],
  la: [154, 191],
  rh: [141, 112],
  rk: [142, 149],
  ra: [146, 187],
};
const quadruped: Pose = {
  head: [83, 98],
  ls: [108, 112],
  le: [108, 151],
  lw: [110, 191],
  rs: [116, 104],
  re: [116, 143],
  rw: [118, 183],
  lh: [192, 111],
  lk: [191, 191],
  la: [237, 190],
  rh: [200, 103],
  rk: [199, 183],
  ra: [245, 182],
};
const plank: Pose = {
  head: [79, 109],
  ls: [104, 119],
  le: [106, 155],
  lw: [108, 191],
  rs: [112, 111],
  re: [114, 147],
  rw: [116, 183],
  lh: [177, 140],
  lk: [222, 166],
  la: [267, 191],
  rh: [185, 132],
  rk: [230, 158],
  ra: [275, 183],
};
const prone: Pose = {
  head: [72, 173],
  ls: [96, 179],
  le: [64, 181],
  lw: [33, 185],
  rs: [104, 171],
  re: [72, 173],
  rw: [41, 177],
  lh: [172, 180],
  lk: [219, 184],
  la: [268, 190],
  rh: [180, 172],
  rk: [227, 176],
  ra: [276, 182],
};
const supine: Pose = {
  head: [60, 178],
  ls: [87, 180],
  le: [124, 186],
  lw: [158, 190],
  rs: [95, 172],
  re: [132, 178],
  rw: [166, 182],
  lh: [164, 186],
  lk: [200, 140],
  la: [241, 191],
  rh: [172, 178],
  rk: [208, 132],
  ra: [249, 183],
};
const tabletop = pose(supine, {
  lk: [165, 133],
  la: [220, 133],
  rk: [173, 125],
  ra: [228, 125],
});
const seated = pose(side, {
  head: [115, 49],
  ls: [116, 77],
  le: [119, 109],
  lw: [153, 128],
  rs: [108, 69],
  re: [111, 101],
  rw: [145, 120],
  lh: [118, 130],
  lk: [171, 135],
  la: [174, 191],
  rh: [110, 122],
  rk: [163, 127],
  ra: [166, 183],
});
const standingArmsUp = pose(front, {
  le: [119, 35],
  lw: [113, 12],
  re: [201, 35],
  rw: [207, 12],
});
const frame = (label: string, cue: string, p: Pose): MotionFrame => ({
  label,
  cue,
  pose: p,
});
function cycle(
  start: Pose,
  move: Pose,
  cue: string,
  support: MotionMap["support"] = "none",
  view = "Side schematic",
): MotionMap {
  return {
    view,
    support,
    frames: [
      frame("START", "Settle into the starting position.", start),
      frame("MOVE", cue, move),
      frame("RETURN", "Return fully before another repetition.", start),
    ],
  };
}
function hold(
  start: Pose,
  active: Pose,
  cue: string,
  support: MotionMap["support"] = "floor",
  view = "Side schematic",
): MotionMap {
  return {
    view,
    support,
    frames: [
      frame("SET UP", "Begin supported; settle comfortably.", start),
      frame("HOLD", cue, active),
      frame("REST", "Release and rest whenever you need.", start),
    ],
  };
}
function squat(depth: number, wide = false): Pose {
  const base = wide
    ? pose(front, {
        lk: [113, 154],
        la: [103, 191],
        rk: [207, 154],
        ra: [217, 191],
      })
    : side;
  return wide
    ? pose(base, {
        head: [160, 35 + depth],
        ls: [140, 61 + depth],
        rs: [180, 61 + depth],
        le: [123, 90 + depth],
        re: [197, 90 + depth],
        lw: [145, 84 + depth],
        rw: [175, 84 + depth],
        lh: [144, 116 + depth],
        rh: [176, 116 + depth],
      })
    : pose(base, {
        head: [132, 33 + depth],
        ls: [134, 61 + depth],
        rs: [126, 57 + depth],
        le: [159, 75 + depth],
        re: [151, 71 + depth],
        lw: [183, 74 + depth],
        rw: [175, 70 + depth],
        lh: [126, 116 + depth],
        rh: [118, 112 + depth],
        lk: [169, 162],
        rk: [161, 158],
      });
}
const lunge = pose(side, {
  head: [157, 58],
  ls: [158, 86],
  rs: [150, 78],
  lh: [157, 137],
  rh: [149, 129],
  le: [175, 108],
  lw: [156, 106],
  re: [133, 111],
  rw: [155, 109],
  lk: [203, 143],
  la: [205, 191],
  rk: [113, 165],
  ra: [82, 191],
});
const lowPushup = pose(plank, {
  head: [87, 153],
  ls: [111, 162],
  rs: [119, 154],
  le: [137, 174],
  re: [145, 166],
  lh: [185, 171],
  rh: [193, 163],
  lk: [226, 180],
  rk: [234, 172],
});
const kneePlank = pose(plank, {
  lh: [159, 143],
  rh: [167, 135],
  lk: [210, 190],
  rk: [218, 182],
  la: [249, 160],
  ra: [257, 152],
});
const kneeLow = pose(lowPushup, {
  lh: [164, 178],
  rh: [172, 170],
  lk: [210, 190],
  rk: [218, 182],
  la: [249, 160],
  ra: [257, 152],
});
const wallStart = pose(side, {
  head: [166, 40],
  ls: [165, 66],
  rs: [157, 58],
  le: [202, 69],
  lw: [239, 70],
  re: [194, 61],
  rw: [231, 62],
  lh: [154, 119],
  rh: [146, 111],
});
const wallBent = pose(wallStart, {
  head: [205, 47],
  ls: [199, 73],
  rs: [191, 65],
  le: [217, 96],
  re: [209, 88],
  lh: [171, 125],
  rh: [163, 117],
});
const reachBird = pose(quadruped, {
  le: [71, 108],
  lw: [33, 105],
  rk: [241, 105],
  ra: [281, 107],
});
const liftSuper = pose(prone, {
  head: [74, 165],
  ls: [97, 172],
  rs: [105, 164],
  le: [65, 165],
  lw: [34, 159],
  re: [73, 157],
  rw: [42, 151],
  lk: [219, 176],
  la: [267, 165],
  rk: [227, 168],
  ra: [275, 157],
});
const bridge = pose(supine, { lh: [163, 152], rh: [171, 144] });
const hipsBack = pose(quadruped, {
  head: [117, 110],
  ls: [137, 124],
  rs: [145, 116],
  le: [121, 157],
  re: [129, 149],
  lh: [215, 146],
  rh: [223, 138],
});
const outArms = pose(front, {
  le: [106, 70],
  lw: [72, 72],
  re: [214, 70],
  rw: [248, 72],
});
const guard = pose(front, {
  le: [120, 92],
  lw: [137, 73],
  re: [200, 92],
  rw: [183, 73],
});
const supineUpArms = pose(tabletop, {
  le: [89, 143],
  lw: [89, 107],
  re: [97, 135],
  rw: [97, 99],
});
const maps: Record<string, MotionMap> = {
  "mini-squat": cycle(side, squat(17), "Make a shallow bend, then stand."),
  squat: cycle(
    side,
    squat(35),
    "Bend hips and knees within your comfortable range.",
  ),
  "sumo-squat": cycle(
    pose(front, {
      la: [103, 191],
      ra: [217, 191],
      lk: [120, 153],
      rk: [200, 153],
    }),
    squat(28, true),
    "Lower between your comfortably wider feet.",
    "none",
    "Front schematic",
  ),
  lunge: cycle(
    side,
    lunge,
    "Step forward; bend both knees. The named side leads.",
  ),
  "assisted-lunge": cycle(
    pose(side, { le: [120, 92], lw: [90, 116] }),
    pose(lunge, { le: [121, 105], lw: [90, 116] }),
    "Use a stable support and a comfortable split-stance bend.",
    "rail",
  ),
  "reverse-lunge": cycle(
    side,
    pose(lunge, { lk: lunge.rk, la: lunge.ra, rk: lunge.lk, ra: lunge.la }),
    "Step the named leg BACK, then return.",
    "none",
    "Side schematic · backward step",
  ),
  "single-leg-squat": cycle(
    pose(side, { rk: [178, 139], ra: [199, 166] }),
    pose(squat(19), { rk: [165, 157], ra: [198, 167] }),
    "Make a small bend in the supporting leg.",
    "rail",
  ),
  "wall-sit": hold(
    pose(side, {
      head: [105, 34],
      ls: [106, 62],
      rs: [98, 54],
      lh: [108, 118],
      rh: [100, 110],
      lk: [130, 154],
      la: [155, 191],
      rk: [122, 146],
      ra: [147, 183],
    }),
    pose(seated, {
      head: [105, 49],
      ls: [106, 77],
      rs: [98, 69],
      lh: [108, 130],
      rh: [100, 122],
    }),
    "Keep a comfortable bent-knee position; breathe.",
    "wall",
  ),
  "wall-pushup": cycle(
    wallStart,
    wallBent,
    "Bend the elbows and move your torso toward the wall.",
    "wall",
  ),
  "close-wall-pushup": cycle(
    wallStart,
    wallBent,
    "Use a comfortably closer hand spacing; press and return.",
    "wall",
  ),
  "incline-pushup": cycle(
    pose(plank, {
      head: [102, 64],
      ls: [121, 84],
      rs: [129, 76],
      le: [140, 117],
      re: [148, 109],
      lw: [158, 147],
      rw: [166, 139],
      lh: [183, 122],
      rh: [191, 114],
    }),
    pose(plank, {
      head: [134, 103],
      ls: [150, 122],
      rs: [158, 114],
      le: [127, 136],
      re: [135, 128],
      lw: [158, 147],
      rw: [166, 139],
      lh: [196, 147],
      rh: [204, 139],
    }),
    "Bend elbows toward a stable raised surface.",
    "bench",
  ),
  "knee-pushup": cycle(
    kneePlank,
    kneeLow,
    "Keep knees supported; lower and press back up.",
    "floor",
  ),
  pushup: cycle(
    plank,
    lowPushup,
    "Lower your torso, then press back to the top.",
    "floor",
  ),
  diamond: cycle(
    plank,
    lowPushup,
    "Keep hands comfortably close; finger placement is not tracked.",
    "floor",
  ),
  "wide-pushup": cycle(
    plank,
    lowPushup,
    "Choose a comfortably wider hand placement; lower and press.",
    "floor",
  ),
  "archer-pushup": cycle(
    pose(front, {
      head: [160, 103],
      ls: [133, 121],
      rs: [187, 121],
      lh: [146, 146],
      rh: [174, 146],
      le: [99, 153],
      lw: [65, 191],
      re: [221, 153],
      rw: [255, 191],
      lk: [133, 166],
      rk: [187, 166],
      la: [120, 191],
      ra: [200, 191],
    }),
    pose(front, {
      head: [119, 134],
      ls: [101, 151],
      rs: [145, 151],
      lh: [116, 168],
      rh: [144, 168],
      le: [74, 165],
      lw: [65, 191],
      re: [201, 171],
      rw: [255, 191],
      lk: [120, 180],
      rk: [166, 180],
      la: [120, 191],
      ra: [200, 191],
    }),
    "Bend one arm; the other stays longer. Return to centre.",
    "floor",
    "Front schematic",
  ),
  "high-plank": hold(
    kneePlank,
    plank,
    "Stay steady on extended arms; lower knees to rest.",
  ),
  birddog: cycle(
    quadruped,
    reachBird,
    "Reach the named arm and OPPOSITE leg, then return.",
    "floor",
    "Three-quarter schematic",
  ),
  superman: hold(
    prone,
    liftSuper,
    "Lift gently; hold with normal breathing. No maximum height.",
  ),
  "back-extension": cycle(
    pose(prone, {
      le: [128, 185],
      lw: [159, 190],
      re: [136, 177],
      rw: [167, 182],
    }),
    pose(prone, {
      head: [75, 153],
      ls: [99, 162],
      rs: [107, 154],
      le: [128, 174],
      lw: [159, 182],
      re: [136, 166],
      rw: [167, 174],
    }),
    "Make a small upper-torso lift, then lower.",
    "floor",
  ),
  "alternating-superman": cycle(
    prone,
    pose(prone, {
      le: [65, 165],
      lw: [34, 159],
      rk: [227, 168],
      ra: [275, 157],
    }),
    "Lift the named arm and opposite leg, then lower.",
    "floor",
    "Three-quarter schematic",
  ),
  sitstand: cycle(
    seated,
    pose(side, {
      head: [154, 33],
      ls: [155, 61],
      rs: [147, 53],
      lh: [157, 116],
      rh: [149, 108],
      lk: [170, 153],
      rk: [162, 145],
      la: [174, 191],
      ra: [166, 183],
    }),
    "Lean slightly forward, stand, then sit with control.",
    "chair",
  ),
  "calf-raise": cycle(
    side,
    pose(
      side,
      Object.fromEntries(
        Object.entries(side).map(([k, p]) => [k, pt(p[0], p[1] - 8)]),
      ),
    ),
    "Raise your heels; keep the balls of your feet supported.",
  ),
  "side-leg-raise": cycle(
    front,
    pose(front, { lk: [119, 151], la: [96, 185] }),
    "Move the named leg sideways and back.",
    "none",
    "Front schematic",
  ),
  "glute-bridge": cycle(
    supine,
    bridge,
    "Lift the hips while shoulders and feet stay supported.",
    "floor",
  ),
  "side-lunge": cycle(
    front,
    pose(front, {
      head: [130, 54],
      ls: [110, 80],
      rs: [150, 80],
      lh: [116, 132],
      rh: [144, 132],
      lk: [93, 152],
      la: [90, 191],
      rk: [195, 160],
      ra: [242, 191],
      le: [111, 106],
      lw: [133, 99],
      re: [165, 106],
      rw: [145, 99],
    }),
    "Step sideways; bend the stepping knee, then return.",
    "rail",
    "Front schematic",
  ),
  "wall-scapular": cycle(
    wallStart,
    pose(wallStart, {
      head: [172, 42],
      ls: [171, 68],
      rs: [163, 60],
      le: [205, 70],
      re: [197, 62],
    }),
    "Keep elbows extended; gently move through the shoulder blades.",
    "wall",
  ),
  "quadruped-scapular": cycle(
    quadruped,
    pose(quadruped, {
      head: [83, 104],
      ls: [108, 118],
      rs: [116, 110],
      spine: [150, 124],
    }),
    "Keep elbows still; small shoulder-blade movement. Confirm yourself.",
    "floor",
  ),
  "quadruped-tap": cycle(
    quadruped,
    pose(quadruped, { le: [96, 134], lw: [116, 104] }),
    "Touch the opposite shoulder with the named hand, then replace it.",
    "floor",
    "Three-quarter schematic",
  ),
  "plank-tap": cycle(
    plank,
    pose(plank, { le: [93, 144], lw: [112, 111] }),
    "Lift the named hand toward the opposite shoulder, then replace it.",
    "floor",
    "Three-quarter schematic",
  ),
  "scapular-retraction": cycle(
    front,
    pose(front, {
      ls: [143, 62],
      rs: [177, 62],
      le: [134, 94],
      re: [186, 94],
      lw: [137, 121],
      rw: [183, 121],
    }),
    "Gently draw shoulder blades together, then release.",
    "none",
    "Front schematic · internal movement needs confirmation",
  ),
  "hip-extension": cycle(
    quadruped,
    pose(quadruped, { lk: [237, 113], la: [281, 114] }),
    "Keep both hands down; reach the named leg back and return.",
    "floor",
  ),
  "deadbug-tap": cycle(
    supineUpArms,
    pose(supineUpArms, { lk: [200, 140], la: [239, 191] }),
    "Lower the named heel toward the floor, then return.",
    "floor",
    "Three-quarter schematic",
  ),
  deadbug: cycle(
    supineUpArms,
    pose(supineUpArms, {
      le: [53, 163],
      lw: [23, 147],
      rk: [220, 153],
      ra: [269, 164],
    }),
    "Reach the named arm overhead and the opposite leg away.",
    "floor",
    "Three-quarter schematic",
  ),
  "supine-march": cycle(
    supine,
    pose(supine, { lk: [174, 133], la: [216, 163] }),
    "Lift the named bent leg, replace the foot, then change sides.",
    "floor",
  ),
  "heel-slide": cycle(
    supine,
    pose(supine, { lk: [215, 184], la: [270, 191] }),
    "Slide one heel away; slide it back without lifting the torso.",
    "floor",
  ),
  "abdominal-brace": hold(
    supine,
    supine,
    "Stay still and breathe. Muscle effort is not visible; confirm seconds.",
  ),
  "forearm-plank": hold(
    pose(kneePlank, {
      le: [107, 190],
      lw: [70, 191],
      re: [115, 182],
      rw: [78, 183],
    }),
    pose(plank, {
      le: [107, 190],
      lw: [70, 191],
      re: [115, 182],
      rw: [78, 183],
    }),
    "Forearms supported; hold your body steady and keep breathing.",
  ),
  crunch: cycle(
    supine,
    pose(supine, {
      head: [68, 157],
      ls: [95, 163],
      rs: [103, 155],
      le: [129, 171],
      lw: [163, 178],
      re: [137, 163],
      rw: [171, 170],
    }),
    "Curl upper torso a small amount, then lower.",
    "floor",
  ),
  "reverse-crunch": cycle(
    tabletop,
    pose(tabletop, {
      lh: [160, 175],
      rh: [168, 167],
      lk: [148, 125],
      rk: [156, 117],
      la: [200, 120],
      ra: [208, 112],
    }),
    "Small pelvis curl, then lower. Do not swing the legs.",
    "floor",
  ),
  "hollow-tuck": hold(
    supine,
    pose(tabletop, {
      head: [72, 150],
      ls: [97, 158],
      rs: [105, 150],
      le: [132, 155],
      lw: [165, 151],
      re: [140, 147],
      rw: [173, 143],
    }),
    "Keep a comfortable tuck and small shoulder lift; breathe normally.",
  ),
  tabletop: hold(
    supine,
    tabletop,
    "Hold bent legs above the hips; lower feet to rest.",
  ),
  "seated-march": cycle(
    seated,
    pose(seated, { lk: [166, 115], la: [177, 167] }),
    "Lift the named bent knee, then replace the foot.",
    "chair",
  ),
  "cross-knee": cycle(
    guard,
    pose(guard, {
      lk: [130, 119],
      la: [139, 158],
      re: [171, 112],
      rw: [166, 90],
    }),
    "Bring the named knee toward the opposite elbow; no touch required.",
    "none",
    "Front schematic",
  ),
  "knee-hover": cycle(
    quadruped,
    pose(quadruped, { lk: [191, 181], rk: [199, 173] }),
    "Hover knees a small amount, then lower. Confirm the full cycle.",
    "floor",
  ),
  march: cycle(
    front,
    pose(front, {
      lk: [137, 132],
      la: [144, 165],
      le: [121, 85],
      lw: [134, 65],
      re: [192, 99],
      rw: [185, 125],
    }),
    "Lift and replace one foot at a comfortable pace.",
    "none",
    "Front schematic",
  ),
  "high-march": cycle(
    front,
    pose(front, { lk: [131, 114], la: [138, 151] }),
    "Lift the named knee to a comfortable height; replace the foot.",
    "none",
    "Front schematic",
  ),
  jog: cycle(
    front,
    pose(front, {
      lk: [137, 143],
      la: [132, 170],
      le: [121, 85],
      lw: [137, 65],
      re: [197, 84],
      rw: [181, 65],
    }),
    "Light alternating steps. Choose marching for no flight phase.",
    "none",
    "Front schematic · impact is not measured",
  ),
  "step-touch": cycle(
    front,
    pose(front, { lk: [118, 154], la: [93, 191] }),
    "Step sideways, then bring the other foot beside it.",
    "none",
    "Front schematic",
  ),
  "step-jack": cycle(
    front,
    pose(standingArmsUp, { lk: [119, 154], la: [93, 191] }),
    "Step one foot out as arms rise; return before changing legs.",
    "none",
    "Front schematic",
  ),
  "jumping-jack": cycle(
    front,
    pose(standingArmsUp, {
      lk: [121, 153],
      la: [91, 191],
      rk: [199, 153],
      ra: [229, 191],
    }),
    "Open arms and feet, then land with control and return.",
    "none",
    "Front schematic",
  ),
  "heel-dig": cycle(
    side,
    pose(side, { lk: [178, 149], la: [208, 190] }),
    "Place the named heel forward with toes lifted, then return.",
  ),
  "straight-punch": cycle(
    guard,
    pose(guard, { le: [103, 72], lw: [68, 72] }),
    "Reach the named arm forward, then return to guard.",
    "none",
    "Three-quarter schematic",
  ),
  uppercut: cycle(
    guard,
    pose(guard, { le: [122, 92], lw: [130, 50] }),
    "Short upward arc of the named fist; return to guard.",
    "none",
    "Front schematic",
  ),
  skater: cycle(
    front,
    pose(front, {
      head: [123, 48],
      ls: [103, 73],
      rs: [143, 73],
      lh: [109, 128],
      rh: [137, 128],
      lk: [94, 159],
      la: [83, 191],
      rk: [156, 155],
      ra: [111, 183],
      le: [95, 109],
      lw: [120, 125],
      re: [173, 94],
      rw: [198, 81],
    }),
    "Step sideways and tap the other foot behind; no jump.",
    "none",
    "Three-quarter schematic",
  ),
  "step-back-reach": cycle(
    side,
    pose(side, {
      le: [149, 29],
      lw: [151, 9],
      re: [141, 21],
      rw: [143, 7],
      rk: [115, 147],
      ra: [81, 190],
    }),
    "Step one foot backward as arms reach comfortably up.",
  ),
  "standing-climber": cycle(
    front,
    pose(front, {
      lk: [134, 117],
      la: [141, 153],
      re: [195, 35],
      rw: [200, 10],
    }),
    "Lift the named knee and reach the opposite arm up.",
    "none",
    "Front schematic",
  ),
  "plank-climber": cycle(
    plank,
    pose(plank, { lk: [146, 167], la: [180, 192] }),
    "Draw the named knee toward the torso, then return the foot.",
    "floor",
  ),
  "wall-slide": cycle(
    pose(front, { le: [111, 63], lw: [111, 33], re: [209, 63], rw: [209, 33] }),
    standingArmsUp,
    "Slide or reach arms up comfortably, then lower.",
    "wall",
    "Front schematic",
  ),
  "chest-opening": cycle(
    guard,
    outArms,
    "Open arms gently and return in front.",
    "none",
    "Front schematic",
  ),
  "seated-rotation": cycle(
    pose(seated, {
      le: [138, 95],
      lw: [112, 78],
      re: [130, 87],
      rw: [120, 86],
    }),
    pose(seated, {
      ls: [125, 77],
      rs: [103, 73],
      le: [145, 95],
      lw: [103, 79],
      re: [122, 91],
      rw: [125, 80],
      head: [117, 49],
    }),
    "Turn the upper torso, return to centre, then change sides.",
    "chair",
    "Three-quarter schematic · depth turn shown schematically",
  ),
  "quadruped-rotation": cycle(
    pose(quadruped, { le: [91, 136], lw: [84, 98] }),
    pose(quadruped, { le: [91, 73], lw: [84, 98] }),
    "Lift the named elbow outward with a comfortable upper-body turn.",
    "floor",
    "Three-quarter schematic",
  ),
  rockback: cycle(
    quadruped,
    hipsBack,
    "Move hips toward heels while hands stay supported.",
    "floor",
  ),
  "hip-hinge": cycle(
    side,
    pose(side, {
      head: [185, 71],
      ls: [170, 94],
      rs: [162, 86],
      lh: [130, 132],
      rh: [122, 124],
      le: [179, 122],
      lw: [174, 150],
      re: [171, 114],
      rw: [166, 142],
      lk: [147, 161],
      rk: [139, 153],
    }),
    "Hips move back as torso tips forward; return to standing.",
  ),
  "ankle-rock": cycle(
    pose(side, {
      lk: [177, 151],
      la: [185, 191],
      rk: [126, 151],
      ra: [108, 191],
    }),
    pose(side, {
      lk: [194, 150],
      la: [185, 191],
      rk: [130, 153],
      ra: [108, 191],
      lh: [157, 120],
      rh: [149, 112],
    }),
    "Move the front knee gently forward, keeping its heel down.",
  ),
  "seated-extension": cycle(
    seated,
    pose(seated, { la: [222, 140] }),
    "Straighten one knee comfortably, then replace the foot.",
    "chair",
  ),
  "wrist-rock": cycle(
    quadruped,
    pose(quadruped, {
      head: [67, 99],
      ls: [92, 112],
      rs: [100, 104],
      le: [100, 152],
      re: [108, 144],
      lh: [179, 111],
      rh: [187, 103],
    }),
    "Small shoulder shift over the hands; return without forcing wrists.",
    "floor",
  ),
  "side-bend": cycle(
    front,
    pose(front, {
      head: [139, 39],
      ls: [120, 68],
      rs: [160, 58],
      le: [113, 101],
      lw: [116, 132],
      re: [171, 90],
      rw: [175, 120],
    }),
    "Slide a hand down the named side; return upright.",
    "none",
    "Front schematic",
  ),
};

// Top-view schematics explain arm shape without pretending a frontal silhouette
// demonstrates a prone raise. Lift/lower is annotated separately from the W/T/Y shape.
const proneTop = pose(front, {
  head: [160, 44],
  ls: [140, 69],
  rs: [180, 69],
  lh: [147, 126],
  rh: [173, 126],
  lk: [144, 160],
  rk: [176, 160],
  la: [141, 192],
  ra: [179, 192],
});
for (const [id, arms] of Object.entries({
  "prone-w": { le: [114, 91], lw: [102, 59], re: [206, 91], rw: [218, 59] },
  "prone-t": { le: [104, 69], lw: [69, 69], re: [216, 69], rw: [251, 69] },
  "prone-y": { le: [115, 42], lw: [91, 19], re: [205, 42], rw: [229, 19] },
} as const)) {
  const shape = pose(proneTop, arms);
  maps[id] = {
    view: "Top schematic · lying face down",
    support: "floor",
    detail:
      "The W / T / Y is your arm shape. Lift hands and elbows gently AWAY from the floor; lower to finish.",
    frames: [
      frame("START", "Rest arms on the floor in this shape.", shape),
      frame(
        "LIFT",
        "Small lift away from the floor; keep this arm shape.",
        shape,
      ),
      frame("LOWER", "Lower hands and arms back to the floor.", shape),
    ],
  };
}
maps["snow-angels"] = cycle(
  pose(proneTop, {
    le: [124, 100],
    lw: [121, 130],
    re: [196, 100],
    rw: [199, 130],
  }),
  pose(proneTop, {
    le: [111, 42],
    lw: [101, 11],
    re: [209, 42],
    rw: [219, 11],
  }),
  "Sweep arms from sides toward overhead; reverse the same path.",
  "floor",
  "Top schematic · lying face down",
);
const kneeSide = pose(supine, {
  head: [79, 112],
  ls: [99, 130],
  rs: [105, 125],
  le: [96, 190],
  lw: [57, 191],
  re: [139, 155],
  rw: [163, 170],
  lh: [160, 181],
  rh: [166, 176],
  lk: [208, 191],
  rk: [214, 186],
  la: [251, 172],
  ra: [257, 167],
});
maps["knee-side-plank"] = cycle(
  kneeSide,
  pose(kneeSide, { lh: [160, 149], rh: [166, 144] }),
  "Lift hips while supported on forearm and bent knees. Change support side after returning.",
  "floor",
  "Side-support schematic",
);
const fullSide = pose(kneeSide, {
  lk: [211, 186],
  rk: [217, 181],
  la: [269, 191],
  ra: [275, 186],
});
maps["side-plank"] = cycle(
  fullSide,
  pose(fullSide, {
    lh: [160, 149],
    rh: [166, 144],
    lk: [211, 171],
    rk: [217, 166],
  }),
  "Lift hips with legs extended. Lower, then reposition on the other side.",
  "floor",
  "Side-support schematic",
);
maps["cat-cow"] = {
  view: "Side schematic",
  support: "floor",
  detail:
    "The curved line explains back movement; vertebral curvature is NOT a tracked landmark.",
  frames: [
    frame("START", "Hands and knees supported; neutral back.", quadruped),
    frame(
      "ROUND",
      "Gently round the back.",
      pose(quadruped, { head: [82, 115], spine: [150, 84] }),
    ),
    frame(
      "ARCH",
      "Move through a small comfortable arch.",
      pose(quadruped, { head: [82, 91], spine: [150, 135] }),
    ),
    frame(
      "RETURN",
      "Return to neutral. The whole sequence counts once.",
      quadruped,
    ),
  ],
};
maps["squat-reach"] = {
  ...cycle(side, squat(30), "Squat comfortably."),
  frames: [
    frame("START", "Stand with space overhead.", side),
    frame("SQUAT", "Make a comfortable squat.", squat(30)),
    frame(
      "REACH",
      "Stand as both arms reach overhead.",
      pose(side, { le: [150, 30], lw: [151, 9], re: [142, 22], rw: [143, 7] }),
    ),
    frame(
      "RETURN",
      "Lower arms. The complete squat and reach counts once.",
      side,
    ),
  ],
};
maps["two-side-steps"] = {
  view: "Front schematic",
  support: "none",
  frames: [
    frame("START", "Allow room for two short steps.", front),
    frame(
      "STEP 1",
      "Step sideways; bring the other foot toward it.",
      pose(front, { lk: [117, 153], la: [92, 191] }),
    ),
    frame(
      "STEP 2",
      "Take another step in the same direction.",
      Object.fromEntries(
        Object.entries(front).map(([k, p]) => [k, pt(p[0] - 47, p[1])]),
      ) as Pose,
    ),
    frame(
      "FINISH",
      "Confirm the two-step travel once, then reverse direction.",
      Object.fromEntries(
        Object.entries(front).map(([k, p]) => [k, pt(p[0] - 47, p[1])]),
      ) as Pose,
    ),
  ],
};
for (const [id, base, joints, radius] of [
  ["shoulder-circles", front, ["ls", "rs"], 5],
  ["arm-circles", outArms, ["le", "lw", "re", "rw"], 7],
  ["hip-circles", front, ["lh", "rh"], 7],
  ["ankle-circles", pose(seated, { la: [193, 170] }), ["la"], 7],
] as Array<[string, Pose, Array<keyof Pose>, number]>) {
  const moved = (x: number, y: number) =>
    pose(
      base,
      Object.fromEntries(
        joints.map((k) => [k, pt(base[k]![0] + x, base[k]![1] + y)]),
      ),
    );
  maps[id] = {
    view:
      id === "ankle-circles"
        ? "Side schematic"
        : "Front schematic · circle also moves in depth",
    support: id === "ankle-circles" ? "chair" : "none",
    detail:
      "Follow a small comfortable complete circle. The projection only explains direction; confirm each complete circle yourself.",
    frames: [
      frame("START", "Settle into the supported starting position.", base),
      frame(
        "CIRCLE 1",
        "Move through the first part of the circle.",
        moved(-radius, -radius),
      ),
      frame(
        "CIRCLE 2",
        "Continue around, without bouncing.",
        moved(radius, -radius),
      ),
      frame(
        "CIRCLE 3",
        "Complete the lower part of the circle.",
        moved(radius, radius),
      ),
      frame(
        "RETURN",
        "Finish at the starting position. One full circle.",
        base,
      ),
    ],
  };
}

/** Exact skill ID wins over shared transport aliases. Variants add their own sequence. */
export function exerciseMotionMap(id: string): MotionMap {
  const profile = exerciseProfile(id);
  if (!profile || !maps[profile.art])
    throw Error("UNKNOWN_EXERCISE_MOTION_MAP");
  const source = maps[profile.art];
  let result: MotionMap = {
    ...source,
    frames: source.frames.map((f) => ({ ...f })),
  };
  if (id === "pause-squat" || id === "pause-pushup" || id === "pause-birddog") {
    result.frames.splice(
      2,
      0,
      frame(
        "PAUSE",
        "Pause briefly in a comfortable position, then return.",
        result.frames[1].pose,
      ),
    );
  }
  if (
    id === "tempo-squat" ||
    id === "tempo-extension" ||
    id === "eccentric-pushup"
  ) {
    result = {
      ...result,
      detail:
        "Move deliberately through the lowering phase. Diagram playback is not a pace target.",
    };
    result.frames[1] = {
      ...result.frames[1],
      label: "SLOW MOVE",
      cue:
        id === "eccentric-pushup"
          ? "Lower over about three comfortable counts. Knees may help your reset."
          : "Move slowly and with control; do not force the range.",
    };
  }
  if (id === "advanced-birddog")
    result.frames = [
      frame("START", "Begin on hands and knees.", quadruped),
      frame("REACH", "Extend one arm and the opposite leg.", reachBird),
      frame(
        "DRAW IN",
        "Draw that elbow and opposite knee inward.",
        pose(quadruped, {
          le: [143, 142],
          lw: [153, 160],
          rk: [151, 155],
          ra: [187, 177],
        }),
      ),
      frame("REACH AGAIN", "Re-extend the same opposite limbs.", reachBird),
      frame(
        "RETURN",
        "Return both to the floor. The complete sequence counts once.",
        quadruped,
      ),
    ];
  if (id === "short-superman")
    result.detail =
      "Use only a small comfortable lift. This is held time, not repeated lifts.";
  return result;
}
