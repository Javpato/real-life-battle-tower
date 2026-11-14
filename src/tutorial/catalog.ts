import type { GuideScope, GuideSection, GuideStep } from "./types";
type Entry = readonly [
  target: string,
  title: string,
  body: string,
  missing?: string,
];
function section(
  id: GuideScope,
  title: string,
  introduction: string,
  open: string,
  entries: readonly Entry[],
): GuideSection {
  return {
    id,
    title,
    introduction,
    steps: entries.map(([target, name, body, missing], index) => ({
      id: `${id}:${index + 1}:${target}`,
      target,
      title: name,
      body,
      missingTargetBody: missing ?? `${open} ${name}: ${body}`,
      actionLabel: "Next tip",
    })),
  };
}
/** Read-only teaching content. Replaying a guide never dispatches an adventure command. */
export const GUIDE_CATALOG: Readonly<Record<GuideScope, GuideSection>> = {
  battle: section(
    "battle",
    "Battle",
    "Choose a skill, complete its movement, then see your effort affect the encounter.",
    "Start or resume a battle to use these controls.",
    [
      [
        "battle-actions",
        "Your turn",
        "Attack opens your equipped skills. Items use supplies from your bag; resting and other available commands are shown here. Wait for your turn before choosing.",
      ],
      [
        "battle-attack",
        "Choose Attack",
        "Open Attack, then select a skill. Each skill shows its exercise, required units and type information.",
      ],
      [
        "battle-movement",
        "Choose a movement",
        "Choose a skill you can perform comfortably. The tutorial offers three squats or three chair sit-to-stand movements. Later, equip up to four skills from your inventory.",
        "Open Attack during your turn to see the movement choices.",
      ],
      [
        "battle-pause",
        "Rest whenever you need",
        "Pause stops credited exercise immediately. Resume when ready; completed damage and repetitions stay saved.",
      ],
      [
        "battle-actions",
        "Finishing a series",
        "Ending an active series keeps earned damage and consumes the turn. A completed encounter offers Continue adventure to collect its result.",
      ],
    ],
  ),
  camera: section(
    "camera",
    "Exercise camera",
    "The camera processes movement on this device. Manual exercise is always identified as unverified.",
    "Choose an exercise and open its camera controls.",
    [
      [
        "camera-setup",
        "Enable your camera",
        "Allow camera access, use the exercise-specific angle and keep the named joints visible. Starting posture instructions explain what the detector expects.",
      ],
      [
        "camera-guide",
        "See the movement",
        "Open the guide to compare the starting and target positions. Close it with one click when you are ready.",
      ],
      [
        "camera-start",
        "Start when ready",
        "Automatic preparation waits for a visible starting posture and counts down. Start now bypasses automatic preparation; only genuinely observed full movements can count.",
      ],
      [
        "camera-voice",
        "Listen to your coach",
        "Voice follows the current instruction and verified progress. Toggle it here; the game sound setting can mute it. Text guidance remains available.",
      ],
      [
        "camera-pause",
        "Pause recognition",
        "Take as long as you need. Completed units are preserved; resume from a clear starting position.",
      ],
      [
        "camera-recalibrate",
        "Recalibrate deliberately",
        "You have five seconds to step back into position. Hold a valid starting posture for one second, then follow the countdown. Earned progress is kept.",
      ],
      [
        "camera-settings",
        "Camera settings",
        "Choose a camera, front/back view, automatic starting or skeleton display. Changing camera restarts its stream without inventing progress.",
      ],
    ],
  ),
  inventory: section(
    "inventory",
    "Inventory and skills",
    "Your supplies and equipped skills belong to this adventure.",
    "Open Satchel & skills, or Settings → Skills & items.",
    [
      [
        "inventory",
        "Equip your skills",
        "Choose up to four available skills between encounters. Read each exercise and type before equipping it.",
      ],
      [
        "inventory",
        "Understand upgrades",
        "Skill levels and upgrades belong to this save. Visit the shop to buy available upgrades when you have enough coins.",
      ],
      [
        "inventory",
        "Use your supplies",
        "Review the items in your bag. Battle item actions show which supplies are usable during an encounter.",
      ],
      [
        "modal-close",
        "Return to your adventure",
        "Close the inventory with X. Opening and closing a guide never grants rewards.",
      ],
    ],
  ),
  map: section(
    "map",
    "World map",
    "Willowmere connects through Fernway Trail to Summit Hollow.",
    "Open Settings → World map.",
    [
      [
        "map",
        "Find your next destination",
        "Use the map to orient yourself. Explore houses, shops, gyms and the route; the final arena requires three badges.",
      ],
      [
        "world-move",
        "Move through the world",
        "Use WASD, arrow keys or the touch directional buttons. Shift runs on keyboard. Walk up to a doorway or nearby resident.",
        "Close the map to reach the world movement controls.",
      ],
      [
        "world-interact",
        "Speak or interact",
        "When a nearby name appears, press E or Enter, or tap the contextual button. Enter activates a focused UI button instead of interacting through it.",
        "Close the map and approach a resident to see the interaction button.",
      ],
      [
        "world-door",
        "Enter and leave buildings",
        "Approach the visible doorway. Interiors return you outside the same building. Your last valid map position is saved.",
        "Close the map and approach a doorway to enter or leave.",
      ],
      [
        "modal-close",
        "Close the map",
        "Return to the world to travel. The map itself does not teleport or spend currency.",
      ],
    ],
  ),
  shop: section(
    "shop",
    "Shop",
    "Jun sells supplies and skill upgrades for the coins earned in your adventure.",
    "Enter the General Store and speak to Jun.",
    [
      [
        "shop",
        "Buy supplies",
        "Read the item description and price before buying. Purchases spend this save’s coins; unavailable purchases remain disabled.",
      ],
      [
        "shop",
        "Improve a skill",
        "An upgrade shows its current level and price. Confirm only the upgrade you want; inventory shows the resulting skill levels.",
      ],
      [
        "modal-close",
        "Leave the shop",
        "Close the shop window, then leave through the building’s door.",
      ],
    ],
  ),
  alchemy: section(
    "alchemy",
    "Alchemy",
    "Mira explains the supplies you can make with your collected ingredients.",
    "Enter the alchemy laboratory and speak to Mira.",
    [
      [
        "alchemy",
        "Read the recipe",
        "Check the ingredient cost and resulting item before crafting. Recipes consume the displayed ingredients.",
      ],
      [
        "alchemy",
        "Craft a supply",
        "Choose an available recipe. The crafted result goes to this adventure’s inventory; insufficient ingredients disable the action.",
      ],
      [
        "modal-close",
        "Return to the laboratory",
        "Close the recipe window to continue exploring.",
      ],
    ],
  ),
  quest: section(
    "quest",
    "Village challenges",
    "Residents offer exercise challenges that are separate from battle turns.",
    "Speak to a resident with an exercise challenge after completing the introduction tutorial.",
    [
      [
        "quest",
        "Choose your input",
        "Use camera enables verified tracking. Without it, read the starting posture and movement, perform the remaining units, then confirm manually.",
      ],
      [
        "quest",
        "Manual exercise",
        "No camera Start button is needed in manual mode. I completed the exercise marks the challenge unverified; do the movement before confirming.",
      ],
      [
        "quest",
        "Collect the result",
        "Once the target is reached, choose Collect reward. Progress and rewards are saved to this adventure.",
      ],
      [
        "modal-close",
        "Leave a challenge",
        "X or Stop safely ends this challenge. If uncollected progress would be lost, review the confirmation before leaving.",
      ],
    ],
  ),
  settings: section(
    "settings",
    "Game settings",
    "Adjust the adventure and revisit help without replacing your save.",
    "Open the Settings button in the top game bar.",
    [
      [
        "settings",
        "Review your adventurer",
        "See level, currency, badges and available menu destinations. Your protagonist selection belongs to this save.",
      ],
      [
        "settings",
        "Sound and fullscreen",
        "Use the game’s sound and fullscreen controls. Browser fullscreen starts only after your input; the game already fills its available window.",
      ],
      [
        "settings",
        "Choose difficulty",
        "Difficulty can be changed between battles. An active encounter keeps its current rules.",
      ],
      [
        "settings",
        "Replay the introduction",
        "Replay the story presentation from settings. A replay or help tour does not award XP, currency or tutorial rewards.",
      ],
      [
        "settings",
        "Save and return to title",
        "Use Save & return to title to choose another slot. Resolve pending actions first; a linked cloud adventure must reach a safe stopping point.",
      ],
      [
        "modal-close",
        "Close settings",
        "X returns to the current adventure without starting a different save.",
      ],
    ],
  ),
  devices: section(
    "devices",
    "Devices and cloud",
    "Link the intended adventure and review permissions before sharing access.",
    "Open Settings → Devices or Devices & steps.",
    [
      [
        "devices",
        "Connect the correct save",
        "Device linking applies to the selected adventure. Review the named save before accepting a temporary linking code; do not merge unrelated adventures.",
      ],
      [
        "devices",
        "Request or release control",
        "Only the authorized controlling session changes a cloud adventure. Finish or end an exercise before transferring control.",
      ],
      [
        "devices",
        "Read real step data",
        "On supported Android devices, grant activity permission and start a step session. Browser play cannot produce real device steps.",
      ],
      [
        "devices",
        "Review health imports",
        "Read a Health Connect snapshot where supported, review it, then choose to save it to the journal. A preview alone does not log activity.",
      ],
      [
        "devices",
        "Connection and retry",
        "Offline does not mean unlinked. Pending or failed cloud actions need an explicit safe retry; do not create another save to hide a sync error.",
      ],
      [
        "modal-close",
        "Close device settings",
        "Return to your adventure. Closing this window does not delete the cloud save.",
      ],
    ],
  ),
  "journal-today": section(
    "journal-today",
    "Journal · Today",
    "A daily overview of what you choose to record. Nutrition never earns adventure rewards.",
    "Open Journal, then Today.",
    [
      [
        "journal-tabs",
        "Find a journal section",
        "Today, Food, Activity, Progress and Profile organize your records. Switch tabs without changing the selected adventure.",
      ],
      [
        "journal-date",
        "Choose the date",
        "Use the previous/next controls or date field to inspect a day. Check the date before logging an entry.",
      ],
      [
        "journal-add",
        "Add a meal entry",
        "Choose a meal and add a food. Review its portion before saving; searching or scanning alone does not record consumption.",
      ],
      [
        "journal",
        "Understand the overview",
        "The dashboard reflects saved entries and your chosen profile. Unknown nutrients remain unknown rather than being invented.",
      ],
      [
        "journal-close",
        "Return to the game",
        "Use Return to adventure. Your saved journal remains available in this adventure.",
      ],
    ],
  ),
  "journal-food": section(
    "journal-food",
    "Journal · Food",
    "Find a food, check its label and confirm the portion you actually want to record.",
    "Open Journal → Food, or choose Add food from a meal.",
    [
      [
        "journal-search",
        "Search for a food",
        "Search saved foods or look up a barcode. Online product lookup needs a connection; verify the result before logging.",
      ],
      [
        "journal-scanner",
        "Scan a barcode",
        "Allow the scanner when you want to identify a product. Scanning does not add an entry until you confirm a portion.",
      ],
      [
        "journal-manual",
        "Enter a food manually",
        "Use the package label or your own known values. Leave unknown nutrients unknown; do not estimate them just to fill every field.",
      ],
      [
        "journal-portion",
        "Confirm the portion",
        "Check quantity, unit, meal and date, then save. Editing quantity changes the recorded portion; delete removes only that chosen entry.",
      ],
      [
        "journal-recipes",
        "Work with recipes",
        "Combine ingredients and review the cooked yield. Portion size controls how much of the recipe is logged.",
      ],
    ],
  ),
  "journal-activity": section(
    "journal-activity",
    "Journal · Activity",
    "Record movement independently of battle rewards and camera verification.",
    "Open Journal → Activity.",
    [
      [
        "journal-tab-activity",
        "Open activity records",
        "Review recorded activity for the selected date. Game movements and imported health records are different sources.",
      ],
      [
        "journal-activity-form",
        "Add an activity",
        "Enter the activity details and save once. Review the displayed estimates and source before accepting an imported entry.",
      ],
      [
        "journal-date",
        "Check the activity date",
        "Choose the correct day before logging. Use the delete action only for the specific record you intend to remove.",
      ],
      [
        "journal-settings",
        "Review exercise credit",
        "Additional exercise credit is a separate journal preference and defaults to zero to avoid counting habitual activity twice.",
        "Open Journal → Profile to review journal preferences.",
      ],
    ],
  ),
  "journal-progress": section(
    "journal-progress",
    "Journal · Progress",
    "Inspect trends over time, with records and context rather than game scores.",
    "Open Journal → Progress.",
    [
      [
        "journal-tab-progress",
        "Review your history",
        "Trends depend on recorded measurements and dates. Missing days do not imply an outcome.",
      ],
      [
        "journal-weight-form",
        "Record a measurement",
        "Check the measurement and date before saving. You can remove an incorrect entry without deleting the whole journal.",
      ],
      [
        "journal-reports",
        "Reports and exports",
        "Use reports to review the data behind a summary. CSV, complete JSON and Print / Save PDF serve different export needs.",
      ],
      [
        "journal-profile-form",
        "Review profile assumptions",
        "Profile inputs and activity assumptions affect estimates. Review them when circumstances change; proposals need your explicit acceptance.",
        "Open Journal → Profile to review your inputs.",
      ],
    ],
  ),
  "journal-reports": section(
    "journal-reports",
    "Journal · Reports",
    "Review and export the records you choose to share.",
    "Open Journal → Progress and scroll to reports and exports.",
    [
      [
        "journal-reports",
        "Read the report",
        "Check the period, recorded values and missing data before interpreting the summary.",
      ],
      [
        "journal-reports",
        "Export CSV",
        "CSV provides tabular entries for another spreadsheet tool. Check the selected period and contents before sharing it.",
      ],
      [
        "journal-reports",
        "Export complete JSON",
        "JSON is a backup artifact of the available journal data. Do not assume an import/restore flow exists unless the interface offers one.",
      ],
      [
        "journal-reports",
        "Print or save a PDF",
        "Use Print / Save PDF to open the browser’s print dialog. Review the preview before printing or saving.",
      ],
    ],
  ),
  "journal-settings": section(
    "journal-settings",
    "Journal · Settings",
    "Your journal preferences and profile are separate from adventure difficulty.",
    "Open Journal → Profile.",
    [
      [
        "journal-tab-profile",
        "Open your profile",
        "Review the information used for journal calculations. Save edits explicitly.",
      ],
      [
        "journal-profile-form",
        "Save profile details",
        "Check units and dated inputs. Different resting-energy methods have different required inputs; use only a method whose inputs you know.",
      ],
      [
        "journal-settings",
        "Choose preferences",
        "Adjust reminders and journal display options. These settings do not grant battle progress or reward eating less.",
      ],
      [
        "journal-settings",
        "Delete deliberately",
        "Deletion is separate from closing the journal. Read which local or linked journal is affected, and confirm only when you intend to remove it.",
      ],
      [
        "journal-close",
        "Return to your adventure",
        "Leave the journal without deleting the saved entries.",
      ],
    ],
  ),
};
export const GUIDE_SCOPES = Object.values(GUIDE_CATALOG);
export function getGuideSteps(scope: GuideScope): readonly GuideStep[] {
  return GUIDE_CATALOG[scope].steps;
}
