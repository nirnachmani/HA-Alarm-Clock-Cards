# HA Alarm Clock Cards

Custom Lovelace cards that pair with the [HA Alarm Clock integration](https://github.com/nirnachmani/HA-Alarm-Clock). The cards provide full UI control over alarms and reminders, including media browsing/search, editing, and playback management.

## Features

- **Unified alarm/reminder overview** with quick status indicators.
- **Create/edit flows** matching the integration service schema (time/date, repeat options, media, snooze defaults, activation entities, etc.).
- **Controls** to stop, snooze, or enable/disable each entry.
- **Media picker** powered by HA's Media Browser plus optional Music Assistant/SpotifyPlus search.
- **On-card media sampling** (when supported) so you can preview sounds before saving.

## Installation

1. Copy the `ha_alarm_clock_cards` folder into `config/www/ha_alarm_clock_cards/` inside your Home Assistant config.
2. In Home Assistant, open **Settings → Dashboards ⋮ (in the top right corner) → Resources → Add Resource**
- enter `/hacsfiles/ha_alarm_clock/alarms-card.js` and choose **JavaScript Module** as the resource type for the alarm card, and/or,
- enter `/hacsfiles/ha_alarm_clock/reminders-card.js` and choose **JavaScript Module** as the resource type for the reminders card
3. Reload the browser

## Usage

1. Edit a dashboard.
2. Add a card and set `type: custom:alarms-card` or `type: custom:reminders-card`.

Per-item actions:
- Tap to disable/enable items
- Long press to edit items or use the edit icon in the right corner
- For active item, use short press to snooze and long press to stop or vice versa, depedning on the integration configuration

## License

MIT - see `LICENSE`.
