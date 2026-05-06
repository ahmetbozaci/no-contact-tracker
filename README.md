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
