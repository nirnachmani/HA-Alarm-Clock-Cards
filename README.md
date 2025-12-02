# HA Alarm Clock Cards

Custom Lovelace cards that pair with the [HA Alarm Clock integration](https://github.com/nirnachmani/HA-Alarm-Clock). The cards provide full UI control over alarms and reminders, including media browsing/search, editing, and playback management.

## Features

- **Unified alarm/reminder overview** with quick status indicators.
- **Create/edit flows** matching the integration service schema (time/date, repeat options, media, snooze defaults, activation entities, etc.).
- **Controls** to stop, snooze, or enable/disable each entry.
- **Media picker** powered by HA's Media Browser plus optional Music Assistant/SpotifyPlus search.
- **On-card media sampling** (when supported) so you can preview sounds before saving.
- **Per-item volume overrides** so alarms/reminders can run at a custom loudness without permanently changing the media player volume.

## Installation

### HACS (recommended)
1. Open **HACS → ⋮ (in the top right corner) → Custom repositories**.
2. Add `https://github.com/nirnachmani/HA-Alarm-Clock-Cards`, under type choose **Dashboard** and click **ADD**.
3. Search and download “HA Alarm Clock Cards” in the main HACS view 
4. HACS will automatically add the alarms-card as a dashboard resource, but not the reminders-card. If you wish to use the reminders-card, open **Settings → Dashboards → ⋮ (in the top right corner) → Resources → Add Resource**, enter `/hacsfiles/HA-Alarm-Clock-Cards/reminders-card.js` as the URL and choose **JavaScript Module** as the resource type, and click Create   

### Manual
1. Copy the cards files into `config/www/HA-Alarm-Clock-Cards/` inside your Home Assistant (if /config/www doesn't exist, create it, then create the `HA-Alarm-Clock-Cards` folder).
2. In Home Assistant, open **Settings → Dashboards → ⋮ (in the top right corner) → Resources → Add Resource**
3. enter `/local/HA-Alarm-Clock-Cards/alarms-card.js` or `/local/HA-Alarm-Clock-Cards/reminders-card.js` and choose **JavaScript Module** as the resource type for the alarm card
4. Repeat to add the other card as resource, if needed
3. Reload the browser

## Usage

To use a card and set `type: custom:alarms-card` or `type: custom:reminders-card` in a HA dashboard.

Per-item actions:
- Tap to disable/enable items
- Long press to edit items or use the edit icon in the right corner
- For active item, use short press to snooze and long press to stop or vice versa, depending on the integration configuration

## License

MIT - see `LICENSE`.
