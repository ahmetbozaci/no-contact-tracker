# No Contact Challenge — Safe Update Version

This version keeps the app frontend-only and localStorage-only, but adds a safer data layer for future website updates.

## Important rule
Do not change `STORAGE_KEY = 'ncc_local_v1'` unless you intentionally want to start a new empty data store. Keeping this key is what lets existing users keep their progress after an update.

## What was added
- `APP_SCHEMA_VERSION` for future data structure changes.
- `migrateState()` to upgrade old saved data safely.
- `normalizeState()` to protect against missing or malformed fields.
- Automatic local backup before migration.
- Manual backup button in Settings.
- Restore latest backup button in Settings.
- Backup before import, reset, and clear-today actions.

## Future feature workflow
When you add a new feature:
1. Add the new field to `defaultState()`.
2. Increase `APP_SCHEMA_VERSION` by 1 only if the saved data structure changed.
3. Add a migration block inside `migrateState()` for the new version.
4. Keep all old fields unless you safely migrate them.
5. Test with old localStorage data before publishing.

Example:
```js
// If you add state.newFeature = [] in v3:
const APP_SCHEMA_VERSION = 3;

if (incomingVersion < 3) {
  nextState.newFeature = Array.isArray(nextState.newFeature) ? nextState.newFeature : [];
}
```

## Still recommended
Users should still export JSON sometimes. Browser storage can be cleared by device/browser settings, private mode, or reinstalling the browser.

## Added in feature upgrade v3
- Trigger tracking inside the emergency urge flow.
- Urge history list with intensity, trigger, message preview, and delete action.
- “Letters I never send” private letter journal.
- Grounding exercise steps inside the emergency modal.
- Share image templates: Soft green, Minimal cream, Calm dark.
- Share image sizes: Portrait, Story, Square.

## Data safety note for v3
This update keeps `STORAGE_KEY = 'ncc_local_v1'` and upgrades saved data through `migrateState()`. Existing users should keep their local progress after replacing the website files.


## Next feature upgrade
Added frontend-only, localStorage-only features:
- Today plan checklist
- Social media boundary tracker
- Contact cost reminder
- Safe people list
- Privacy mode
- Progress insights

All features use the existing storage key so existing user data is preserved.


## Today checklist scope fix
The Today plan and Social media boundaries blocks are intentionally placed inside the `#today` section only.
Do not place those blocks between sections; anything outside `.section` will remain visible across every tab.


## Working cleanup fix
This package is rebuilt from the last known working version after a cleanup attempt moved code before `state` was initialized.
Safe cleanup in this version:
- Keeps `STORAGE_KEY = 'ncc_local_v1'`.
- Keeps the existing working render flow.
- Adds missing button types.
- Keeps Today plan and Social media boundaries inside the Today tab.
- JavaScript syntax checked with `node --check`.
- Duplicate IDs checked.


## UX organization pass
The app now keeps the same features but groups advanced/private tools with native `<details>` sections:
- Today remains focused on check-in, focus, affirmation, and daily boundaries.
- Emergency remains action-first, with preparation, relapse support, urge history, and letters grouped clearly.
- Progress keeps insights and calendar visible while private notes are collapsible.
- Settings keeps essential controls visible and advanced customization/data tools organized.
No storage keys or saved data formats were removed.


## Usability simplification pass
No features were added or removed. This pass makes the existing app easier to use:
- Clearer tab language (`Help`, `Review`).
- Today stays focused on check-in and immediate support.
- Daily boundaries remain available but are collapsed by default.
- Emergency starts with the 20-minute pause as the primary action.
- Advanced/private tools remain available in collapsible sections.
- Mobile tap targets and spacing were softened.
- Storage key and saved data compatibility were preserved.


## Polished usability pass
No major feature expansion. This pass improves ease of use:
- First-time guide on Today.
- Clear privacy indicator in the header when privacy mode is enabled.
- Emergency modal now shows a simple four-step flow.
- Settings shows last export/latest local backup status.
- Quick export button added to data safety card.
- Existing storage key and local-only architecture are preserved.


## User-facing language pass
Technical terms were removed from the app interface where possible:
- `localStorage` is described to users as progress saved privately on this device.
- `JSON` is described as a backup file.
- Export/import/reset wording is friendlier and less developer-focused.
Technical terms remain in code and README where useful for development.


## Reminder feature removed
The browser reminder/alarm UI was removed because website notifications are not reliable enough to behave like a real phone alarm, especially on mobile browsers.
For reliable reminders, users should set a normal phone alarm outside the app.
Existing saved reminder fields are left harmlessly in saved data for compatibility.


## Quality and consistency pass
No new feature category was added. This pass improves existing areas:
- Friendlier empty states for notes, urges, letters, and safe people.
- More consistent privacy masking for sensitive text areas and private records.
- Settings backup tools are separated from reset actions.
- Reset actions are grouped in a safer Danger/Reset area.
- Backup/export feedback is clearer.
- Existing storage key and saved progress compatibility are preserved.


## Share image style update
The progress image generator in the Share section was redesigned to produce a calmer, more polished card inspired by the newer visual direction:
- softer background and rounded card layout
- large milestone headline
- 2x2 stat cards
- calm quote panel
- decorative nature-inspired accents
- still generated locally in-browser with canvas


## Share image streak fix
Fixed the progress image so it uses the correct stats field names when rendering the current streak.


## Settings simplification and accessibility polish
No new app features were added. This pass improves usability:
- Settings labels are ordered and easier to scan.
- Reset options remain separated and closed by default.
- Added skip link for keyboard users.
- Added visible focus styles.
- Tab navigation updates `aria-current`.
- Emergency modal focus is managed more cleanly.
- Added reduced-motion support.


## Prior no-contact days setup
New users can optionally enter how many no-contact days they already completed before starting the app.
The app backfills those completed days up to yesterday, so today's check-in remains available.
This preserves the same storage key and stores the days as normal check-in dates.


## Optional support setup
The first-time setup now includes optional support fields:
- Main reason for no-contact
- Safe person to contact instead
- Emergency help region

The emergency help region is used only to show a small urgent-help card inside Help.
No exact location is collected. Everything remains saved privately on this device.


## Setup reassurance and urgent-help wording
The setup screen now reassures users that optional fields can be skipped and edited later.
The urgent-help card now separates immediate danger numbers from emotional/crisis support numbers where relevant.


## Prior days copy clarification
The setup field for previous no-contact days was reworded so users understand it means they started no-contact before using the app and want to continue their progress here.


## Milestone journey view
The Review tab milestones were updated from simple badges into a playful chapter-style journey path.
The same milestone day numbers are preserved, but each milestone now has a gentle icon, title, and supportive message.
The 90-day milestone avoids saying the user is fully healed and instead frames it as proof of strength and consistency.


## Compact milestone path update
The small visual milestone journey path is kept, but the milestone cards are compact again to avoid long text crowding the Review view.


## Missed days check-in flow
If a returning user has full missing days between the last check-in and today, the Today tab shows a gentle card asking what happened.
Options:
- stayed no-contact: missed days are added as check-ins
- contacted them: saves a restart/relapse note for the missed range
- skip for now: does not change progress and hides that range prompt

The prompt does not appear for brand-new users, does not count today automatically, and remembers answered ranges to avoid repeated prompts.


## Restart support backfilled-days fix
Restart/relapse support now removes successful check-ins from the break date onward.
This keeps the current streak correct when a user started the app with already-completed no-contact days and later records that contact happened.


## Explicit restart date fix
Restart support now stores an explicit `currentStreakResetDate`.
This makes the current streak return to 0 after “I contacted them,” even if the user originally backfilled previous no-contact days during setup.
Historical total successful days can remain, but the active/current streak resets.


## Contact reset visible progress fix
When the user records “I contacted them,” visible progress now resets from zero:
- check-ins are cleared
- reflections are cleared
- current streak, total days, longest streak, and this month become 0
- relapse/restart note is still saved
This matches the restart-support expectation when the user previously entered prior no-contact days during setup.


## Daily reflection hides after save
After the user saves today's mood/reflection, the reflection question is hidden for that day.
It appears again on the next day after the user checks in.


## Today protection plan simplification
The confusing separate “Today plan” and “Social media boundaries” lists were merged into one clearer “Today’s protection plan.”
The reset button was removed because checklist progress is saved by date and naturally starts unchecked on a new day.
Old `boundaryChecks` data is left harmlessly for compatibility, but the UI now uses `todayPlanChecks`.


## Share page mode toggle
The Share page now uses one cleaner flow with two modes:
- Text update
- Picture card

Both sharing methods are preserved, but only one mode is shown at a time to reduce visual clutter.


## Share image size selector removed
The Share page now keeps picture sharing simpler:
- users choose only the image style
- the image size is fixed to portrait 1080×1350
- old `shareImageSize` saved data remains harmless for compatibility


## Share image size listener fix
Removed the old event listener for the deleted image size dropdown so the Share page loads without console errors.


## Safe event binding fix
Event listeners now use a small safe helper so an optional/missing element cannot crash the whole app.
This also protects against stale HTML/script mismatches while testing.


## Share image style distinction
Soft green and Minimal cream were made more visually different:
- Soft green now uses a more clearly green/nature palette.
- Minimal cream now uses a cleaner cream/brown palette with less green feeling.


## Website-wide copy cleanup
A light copy cleanup reduced repeated helper text across Today, Review, Help, Share, and Settings.
Important warnings remain for urgent help, backup, reset, and privacy.
No features, storage keys, or app behavior were changed.


## Removed protection plan helper text
Removed the helper line under Today’s protection plan to reduce visual clutter.


## Share refresh buttons removed
The Share page no longer shows manual refresh buttons.
Copy/share/download actions now regenerate the latest text or picture automatically before running.
Changing the picture style also regenerates the preview automatically.


## Share copy simplification
The Share page top heading/subtitle was removed to reduce clutter.
Share mode labels were shortened to “Text” and “Picture.”


## Larger local reminder list
The Today page reminder list was expanded from 7 to 60 local reminders.
No API is used. The reminder still rotates automatically by day and works offline.
The section title was changed from “Daily affirmation” to “Today’s reminder.”


## Mood-based share image message
The picture share card now uses a short message based on today’s saved mood:
- Calm → I’m choosing peace today.
- Strong → I stayed steady today.
- Sad → I’m being gentle with myself today.
- Anxious → I paused before reacting today.
- Tempted → I chose not to send the message today.
- Hopeful → I’m moving forward gently today.

If no mood is saved, the fallback message remains: “I’m choosing peace today.”
Private notes are still not used in the share image.


## Site-wide dark mode
A dark mode toggle was added to Settings.
The preference is saved locally in the existing app data and applies to the whole website.
No storage key was changed.


## Dark mode contrast fix
Improved readability in dark mode:
- brighter muted/helper text
- clearer card/input/list backgrounds
- better button contrast
- improved calendar, checklist, modal, and Share page contrast


## Poster-style website refresh
The website visual identity was adjusted to be closer to the promotional image:
- cream/sage palette
- softer rounded cards
- serif hero typography
- landscape-style Today card
- calmer shadows and spacing
- privacy trust pill on setup

Features and storage remain unchanged.
