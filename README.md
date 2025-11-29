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

1. Copy the cards files into `config/www/ha_alarm_clock/` inside your Home Assistant (if /config/www doesn't exist, create it).
2. In Home Assistant, open **Settings → Dashboards → ⋮ (in the top right corner) → Resources → Add Resource**
3. enter `/local/ha_alarm_clock/alarms-card.js` or `/local/ha_alarm_clock/reminders-card.js` and choose **JavaScript Module** as the resource type for the alarm card, and/or,
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
