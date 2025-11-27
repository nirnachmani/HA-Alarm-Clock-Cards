import { LitElement, html, css, nothing } from "https://unpkg.com/lit@3.1.2/index.js?module";
import { classMap } from "https://unpkg.com/lit@3.1.2/directives/class-map.js?module";
import { repeat } from "https://unpkg.com/lit@3.1.2/directives/repeat.js?module";
const CARD_VERSION = "0.1.0";
const LONG_PRESS_DEFAULT_MS = 550;
const INTEGRATION_DOMAIN = "ha_alarm_clock";
const DEFAULT_SETTINGS_ENTITY = `sensor.${INTEGRATION_DOMAIN}`;
const RESOLVE_MEDIA_TYPE = `${INTEGRATION_DOMAIN}/resolve_media`;
const DAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const ORDERED_REPEAT_VALUES = ["once", "daily", "weekdays", "weekends", "custom"];
const VALID_REPEAT_VALUES = new Set(ORDERED_REPEAT_VALUES);
const REPEAT_ALIASES = {
  weekly: "custom",
  weekday: "weekdays",
  weekdays: "weekdays",
  weekend: "weekends",
  weekends: "weekends",
  everyday: "daily",
  "every day": "daily",
};
const ACTIVE_PRESS_MODES = {
  short_stop_long_snooze: {
    key: "short_stop_long_snooze",
    short: "Stop",
    long: "Snooze",
  },
  short_snooze_long_stop: {
    key: "short_snooze_long_stop",
    short: "Snooze",
    long: "Stop",
  },
};
const fireEvent = (node, type, detail = {}, options = {}) => {
  const event = new Event(type, {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? true,
    composed: options.composed ?? true,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};
const slugify = (value) => value?.replace?.(/\s+/g, "_").toLowerCase() ?? "";
const formatMediaName = (value) => {
  if (!value) {
    return "";
  }
  const parts = value.split(/[/\\]/);
  const last = parts[parts.length - 1] || value;
  const withoutQuery = last.split("?")[0];
  let noExt = withoutQuery;
  const extMatch = withoutQuery.match(/\.([^.]+)$/);
  if (extMatch) {
    const ext = extMatch[1];
    if (/^[a-z0-9]{1,5}$/i.test(ext)) {
      noExt = withoutQuery.slice(0, -(ext.length + 1));
    }
  }
  const cleaned = noExt
    .replace(/_/g, " ")
    .replace(/(?<!\s)-(?!\s)/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};
const mediaLabelFromDescriptor = (descriptor, fallback) => {
  let label = "";
  if (!descriptor) {
    label = fallback || "";
  } else if (typeof descriptor === "string") {
    label = descriptor;
  } else if (descriptor.media_content_title) {
    label = descriptor.media_content_title;
  } else if (descriptor.media_content_id) {
    label = descriptor.media_content_id;
  } else if (descriptor.original_id) {
    label = descriptor.original_id;
  } else if (descriptor.resolved_url) {
    label = descriptor.resolved_url;
  }
  const formatted = formatMediaName(label || fallback);
  return formatted || "Default sound";
};
const AUDIO_MEDIA_CLASS_SET = new Set([
  "music",
  "audio",
  "album",
  "artist",
  "track",
  "playlist",
  "podcast",
  "genre",
  "radio",
  "collection",
  "library",
  "channel",
  "app",
  "directory",
]);
const AUDIO_CONTENT_TYPE_SET = new Set([
  "music",
  "audio",
  "album",
  "artist",
  "track",
  "playlist",
  "podcast",
  "radio",
  "genre",
  "library",
]);
const AUDIO_SOURCE_PREFIXES = [
  "media-source://media_source/local",
  "media-source://media_source/reminders",
  "media-source://media_source/alarms",
  "media-source://radio_browser",
  "media-source://spotify",
  "media-source://soundcloud",
  "media-source://pandora",
  "media-source://ma",
  "media-source://music_assistant",
  "media-source://youtube_music",
  "media-source://plex",
  "media-source://jellyfin",
];
const MEDIA_TYPE_ID_FALLBACKS = {
  plex: "media-source://plex",
};
const BLOCKED_SOURCE_PREFIXES = [
  "media-source://ai_task",
  "media-source://camera",
  "media-source://frigate",
  "media-source://image",
  "media-source://image_upload",
  "media-source://nest",
  "media-source://reolink",
  "media-source://tts",
  "media-source://text_to_speech",
];
const MEDIA_SEARCH_FILTER_CLASSES = ["music", "track", "album", "artist", "playlist", "genre", "podcast"];
const BLOCKED_MEDIA_CLASS_SET = new Set([
  "image",
  "photo",
  "picture",
  "camera",
  "video",
  "movie",
  "episode",
  "tv_show",
  "app_camera",
]);
const BLOCKED_KEYWORD_SET = new Set([
  "camera",
  "image",
  "images",
  "photo",
  "photos",
  "snapshot",
  "ai_generated",
  "ai generated",
  "generated images",
  "generated_image",
  "security",
  "text-to-speech",
  "text_to_speech",
  "text to speech",
]);
const AUDIO_FILE_EXTENSION_RE = /\.(mp3|wav|ogg|oga|opus|flac|aac|m4a|m4b)$/i;
const MEDIA_PROBE_MAX_DEPTH = 3;
const MEDIA_PROBE_MAX_BRANCHES = 12;
const MEDIA_PLAYER_FAMILY_SPOTIFY = "spotify";
const MEDIA_PLAYER_FAMILY_MUSIC_ASSISTANT = "music_assistant";
const SPOTIFY_PLATFORM_SET = new Set(["spotify", "spotifyplus"]);
const SPOTIFY_BROWSE_BLOCKED_PLATFORMS = new Set(["spotify"]);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "alarms-card")) {
  window.customCards.push({
    type: "alarms-card",
    name: "Alarms Card",
    preview: false,
    description: "Add, edit, snooze, stop, and toggle alarms with an iPad-inspired layout.",
  });
}
class AlarmsCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { state: true },
      _dialogOpen: { state: true },
      _dialogMode: { state: true },
      _formData: { state: true },
      _dialogError: { state: true },
      _saving: { state: true },
      _longPressTimeout: { state: false },
      _mediaBrowserOpen: { state: true },
      _mediaBrowserLoading: { state: true },
      _mediaBrowserError: { state: true },
      _mediaBrowserItems: { state: true },
      _mediaBrowserBreadcrumbs: { state: true },
      _mediaBrowserTarget: { state: true },
      _mediaBrowserMode: { state: true },
      _mediaSearchQuery: { state: true },
      _mediaSearchResults: { state: true },
      _mediaSearchLoading: { state: true },
      _mediaSearchError: { state: true },
      _mediaSearchOptions: { state: true },
      _mediaSearchSupport: { state: true },
      _mediaSearchUnavailable: { state: true },
      _mediaSearchPerformed: { state: true },
      _mediaSearchTelemetry: { state: true },
      _previewSource: { state: true },
      _previewCanPlay: { state: true },
      _previewPlaying: { state: true },
      _previewLoading: { state: true },
      _previewError: { state: true },
    };
  }
  constructor() {
    super();
    this._dialogOpen = false;
    this._dialogMode = "create";
    this._formData = this._blankForm();
    this._dialogError = "";
    this._saving = false;
    this._ttsMemory = null;
    this._spotifyMetadataCache = new Map();
    this._spotifyMetadataPending = new Map();
    this._suppressSpotifyMetadataUpdate = false;
    this._plexMetadataCache = new Map();
    this._plexMetadataPending = new Set();
    this._suppressPlexMetadataUpdate = false;
    this._dlnaMetadataCache = new Map();
    this._dlnaMetadataPending = new Set();
    this._suppressDlnaMetadataUpdate = false;
    this._jellyfinMetadataCache = new Map();
    this._jellyfinMetadataPending = new Set();
    this._suppressJellyfinMetadataUpdate = false;
    this._pressHandle = null;
    this._pressTriggered = false;
    this._pendingPressAlarm = null;
    this._mediaBrowserOpen = false;
    this._mediaBrowserLoading = false;
    this._mediaBrowserError = "";
    this._mediaBrowserItems = [];
    this._mediaBrowserBreadcrumbs = [];
    this._mediaBrowserTarget = "";
    this._mediaBrowserMode = "browse";
    this._mediaSearchQuery = "";
    this._mediaSearchResults = [];
    this._mediaSearchLoading = false;
    this._mediaSearchError = "";
    this._mediaSearchOptions = this._defaultMediaSearchOptions();
    this._mediaSearchSupport = null;
    this._mediaSearchUnavailable = new Set();
    this._mediaSearchPerformed = false;
    this._mediaSearchTelemetry = null;
    this._mediaBrowserSelectionPaths = new Map();
    this._mediaBrowserProbeCache = new Map();
    this._mediaBrowserProbePending = new Map();
    this._mediaBrowserLastChildren = [];
    this._mediaBrowserCurrentContextKey = "";
    this._musicAssistantConfigEntryId = undefined;
    this._musicAssistantConfigEntryPromise = null;
    this._previewSource = null;
    this._previewCanPlay = false;
    this._previewPlaying = false;
    this._previewLoading = false;
    this._previewError = "";
    this._previewUrl = "";
    this._previewAudio = null;
    this._previewRequestId = 0;
    this._spotifyDebugEnabled = this._readSpotifyDebugPreference();
    this._plexDebugEnabled = this._readPlexDebugPreference();
    this._dlnaDebugEnabled = this._readDlnaDebugPreference();
    this._jellyfinDebugEnabled = this._readJellyfinDebugPreference();
  }
  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = {
      title: config.title ?? "Alarms",
      long_press_ms: Number(config.long_press_ms) > 0 ? Number(config.long_press_ms) : LONG_PRESS_DEFAULT_MS,
      legend: config.legend ?? true,
      settings_entity: config.settings_entity || DEFAULT_SETTINGS_ENTITY,
    };
  }
  getCardSize() {
    const alarms = this._getAlarmEntities();
    return Math.max(alarms.length || 1, 2);
  }
  _getSettingsEntityId() {
    if (this._config?.settings_entity) {
      return this._config.settings_entity;
    }
    const states = this.hass?.states || {};
    if (states[DEFAULT_SETTINGS_ENTITY]) {
      return DEFAULT_SETTINGS_ENTITY;
    }
    return DEFAULT_SETTINGS_ENTITY;
  }
  _getIntegrationSettings() {
    const entityId = this._getSettingsEntityId();
    const stateObj = this.hass?.states?.[entityId];
    const attrs = stateObj?.attributes || {};
    const normalizeList = (value) => {
      if (Array.isArray(value)) {
        return value.map((entry) => String(entry).trim()).filter(Boolean);
      }
      if (typeof value === "string" && value.trim()) {
        return [value.trim()];
      }
      return [];
    };
    const coerceNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const pressKey =
      typeof attrs.active_press_mode === "string" && ACTIVE_PRESS_MODES[attrs.active_press_mode]
        ? attrs.active_press_mode
        : "short_stop_long_snooze";
    return {
      entity_id: entityId,
      default_media_player: attrs.default_media_player || "",
      default_alarm_sound: attrs.default_alarm_sound || "",
      default_reminder_sound: attrs.default_reminder_sound || "",
      default_snooze_minutes: coerceNumber(attrs.default_snooze_minutes),
      active_press_mode: pressKey,
      allowed_activation_entities: normalizeList(attrs.allowed_activation_entities),
    };
  }
  _getPressMode() {
    const settings = this._getIntegrationSettings();
    return ACTIVE_PRESS_MODES[settings.active_press_mode] || ACTIVE_PRESS_MODES.short_stop_long_snooze;
  }
  _getDefaultMediaPlayer() {
    return this._getIntegrationSettings().default_media_player || "";
  }
  _getAllowedActivationEntities() {
    return this._getIntegrationSettings().allowed_activation_entities || [];
  }
  _getSnoozeMinutes() {
    return this._getIntegrationSettings().default_snooze_minutes;
  }
  render() {
    if (!this.hass || !this._config) {
      return html``;
    }
    const settings = this._getIntegrationSettings();
    const pressMode = this._getPressMode();
    const settingsMissing = !this.hass.states?.[settings.entity_id];
    const alarms = this._buildAlarmModels();
    return html`
      <ha-card>
        <div class="header">
          <div class="title-row">
            <div class="title">${this._config.title}</div>
            ${this._config.legend && pressMode
              ? html`<div class="legend">
                  <span class="legend-item">Tap -> ${pressMode.short}</span>
                  <span class="legend-item">Hold -> ${pressMode.long}</span>
                </div>`
              : nothing}
          </div>
          <button class="fab top" type="button" @click=${() => this._openDialog("create")} aria-label="Add alarm">
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>
        ${settingsMissing
          ? html`<div class="settings-warning">
              Settings entity <code>${settings.entity_id}</code> not found. Ensure the Alarms & Reminders integration is loaded.
            </div>`
          : nothing}
        ${alarms.length
          ? html`<div class="alarm-grid">${repeat(alarms, (alarm) => alarm.entity_id, (alarm) =>
                this._renderAlarmCard(alarm, pressMode)
              )}</div>`
          : html`<div class="empty-state">
              <div class="empty-icon">
                <ha-icon icon="mdi:alarm-plus"></ha-icon>
              </div>
              <div class="empty-title">No alarms yet</div>
              <div class="empty-body">Tap the + button to schedule your first wake-up.</div>
            </div>`}
      </ha-card>
      ${this._renderDialog()}
      ${this._renderMediaBrowserDialog()}
    `;
  }
  _renderAlarmCard(alarm, pressMode) {
    const classes = classMap({
      "alarm-card": true,
      active: alarm.isActive,
      disabled: !alarm.isEnabled,
      readonly: alarm.readonly,
    });
    return html`
      <div
        class=${classes}
        @pointerdown=${(ev) => this._onPointerDown(ev, alarm)}
        @pointerup=${(ev) => this._onPointerUp(ev, alarm)}
        @pointercancel=${this._clearPendingPress}
        @pointerleave=${this._clearPendingPress}
        tabindex="0"
        @keydown=${(ev) => this._handleKeydown(ev, alarm)}
        role="button"
        aria-label=${`${alarm.displayTime} alarm card`}
      >
        <div class="card-top">
          <div class="card-head-left">
            <div class="time-row">
              <span class="time">${alarm.displayTime}</span>
              <span class="ampm">${alarm.ampm}</span>
              <span class=${classMap({ "status-chip": true, [`status-${alarm.status}`]: true })}>${alarm.statusLabel}</span>
            </div>
            <div class="date-row">
              <span class=${classMap({ date: true, placeholder: !alarm.dateLabel })}>${alarm.dateLabel || "\u00a0"}</span>
              ${alarm.status?.toLowerCase?.() === "scheduled"
                ? html`<button
                    class="skip-button"
                    type="button"
                    title="Skip next alarm occurrence"
                    aria-label="Skip next alarm occurrence"
                    @click=${(ev) => {
                      ev.stopPropagation();
                      this._callStop(alarm);
                    }}
                    @pointerdown=${(ev) => ev.stopPropagation()}
                    @pointerup=${(ev) => ev.stopPropagation()}
                  >
                    <ha-icon icon="mdi:skip-next"></ha-icon>
                    <span>Skip next</span>
                  </button>`
                : nothing}
            </div>
          </div>
          <div class="card-actions">
            <button
              class="icon-button"
              title="Edit alarm"
              type="button"
              aria-label="Edit alarm"
              @click=${(ev) => {
                ev.stopPropagation();
                this._openDialog("edit", alarm);
              }}
              @pointerdown=${(ev) => ev.stopPropagation()}
            >
              <ha-icon icon="mdi:pencil-outline"></ha-icon>
            </button>
          </div>
        </div>
        <div class="name-row">
          ${alarm.displayName
            ? html`<div class="name">${alarm.displayName}</div>`
            : html`<div class="name unnamed">&nbsp;</div>`}
        </div>
        <div class="meta">
          <div class="meta-row">
            <span class="label">Repeat:</span>
            <span class="value">${alarm.repeatLabel}</span>
          </div>
          <div class="meta-row">
            <span class="label">Player:</span>
            <span class="value">${alarm.mediaPlayerLabel}</span>
          </div>
          <div class="meta-row">
            <span class="label">Media:</span>
            <span class="value">${alarm.soundTitle || alarm.soundLabel}</span>
          </div>
        </div>
      </div>
    `;
  }
  _renderDialog() {
    if (!this._dialogOpen) {
      return nothing;
    }
    const isEdit = this._dialogMode === "edit";
    const repeatIsCustom = this._formData.repeat === "custom";
    const mediaPlayers = this._mediaPlayerOptions();
    const currentMediaPlayer = this._normalizeMediaPlayerValue(this._formData.media_player);
    const mediaPlayerOptionsWithFallback =
      currentMediaPlayer && !mediaPlayers.some((entry) => entry.entity_id === currentMediaPlayer)
        ? [
            {
              entity_id: currentMediaPlayer,
              label: this._formatMediaPlayerLabel(currentMediaPlayer),
            },
            ...mediaPlayers,
          ]
        : mediaPlayers;
    const seenPlayers = new Set();
    const selectMediaPlayers = mediaPlayerOptionsWithFallback.filter((entry) => {
      const entityId = this._normalizeMediaPlayerValue(entry.entity_id);
      if (!entityId || seenPlayers.has(entityId)) {
        return false;
      }
      entry.entity_id = entityId;
      seenPlayers.add(entityId);
      return true;
    });
    const activationOptions = this._activationOptions();
    const hasMediaSelection = !!(this._formData.sound_media_id || this._formData._sound_media_descriptor);
    const mediaTitleValue = this._formData.sound_media_title || "";
    const playerFamily = currentMediaPlayer ? this._detectMediaPlayerFamily(currentMediaPlayer) : "unknown";
    const isSpotifyPlayer = playerFamily === MEDIA_PLAYER_FAMILY_SPOTIFY;
    const spotifySourcesRaw = isSpotifyPlayer ? this._getSpotifySourcesForPlayer(currentMediaPlayer) : [];
    const normalizedSpotifySource = isSpotifyPlayer ? this._normalizeSpotifySourceValue(this._formData.spotify_source) : "";
    const spotifySources = normalizedSpotifySource && !spotifySourcesRaw.includes(normalizedSpotifySource)
      ? [normalizedSpotifySource, ...spotifySourcesRaw]
      : spotifySourcesRaw;
    const spotifyMissingSources = isSpotifyPlayer && spotifySourcesRaw.length === 0;
    const spotifySourceValue = normalizedSpotifySource;
    const browseSupported = currentMediaPlayer ? this._playerSupportsMediaBrowser(currentMediaPlayer) : false;
    const browseTooltip = currentMediaPlayer
      ? browseSupported
        ? "Browse media"
        : "Media browser is not available for Spotify"
      : "Select a media player first";
    const formBlocked = spotifyMissingSources;
  const messagePlaceholder = "Optional";
    return html`
      <div class="dialog-backdrop" @click=${this._handleDialogCancel}>
        <div class="dialog-panel" role="dialog" aria-modal="true" @click=${(ev) => ev.stopPropagation()}>
          <div class="dialog-header">
            <h2>${isEdit ? "Edit alarm" : "New alarm"}</h2>
            <button class="icon-button" type="button" @click=${this._handleDialogCancel} aria-label="Close dialog">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="dialog-body">
            ${this._dialogError ? html`<div class="form-error">${this._dialogError}</div>` : nothing}
            <div class="form-grid">
              <label class="field">
                <span>Time</span>
                <input type="time" .value=${this._formData.time} @change=${(ev) => this._updateFormField("time", ev.target.value)} />
              </label>
              <label class="field">
                <span>Date</span>
                <input
                  type="date"
                  .value=${this._formData.date}
                  @change=${(ev) => this._updateFormField("date", ev.target.value)}
                />
              </label>
              <label class="field span-2">
                <span>Name</span>
                <input
                  type="text"
                  placeholder="Optional"
                  .value=${this._formData.name}
                  @input=${(ev) => this._updateFormField("name", ev.target.value)}
                />
              </label>
              ${isSpotifyPlayer
                ? nothing
                : html`<label class="field span-2">
                    <span>Message</span>
                    <input
                      type="text"
                      placeholder=${messagePlaceholder}
                      .value=${this._formData.message}
                      @input=${(ev) => this._updateFormField("message", ev.target.value)}
                    />
                  </label>`}
              <label class="field">
                <span>Repeat</span>
                <select .value=${this._formData.repeat} @change=${(ev) => this._updateFormField("repeat", ev.target.value)}>
                  ${ORDERED_REPEAT_VALUES.map(
                    (option) => html`<option value=${option} ?selected=${option === this._formData.repeat}>
                      ${option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>`
                  )}
                </select>
              </label>
            </div>
            ${repeatIsCustom
              ? html`<div class="day-picker">
                  ${Object.keys(DAY_LABELS).map((day) => {
                    const active = this._formData.repeat_days.includes(day);
                    return html`<button
                      type="button"
                      class=${classMap({ "day-chip": true, active })}
                      data-day=${day}
                      @click=${() => this._toggleRepeatDay(day)}
                    >
                      ${DAY_LABELS[day]}
                    </button>`;
                  })}
                </div>`
              : nothing}
            <div class="form-grid">
              <label class="field span-2">
                <span>Media player</span>
                <select
                  .value=${currentMediaPlayer}
                  @change=${(ev) => this._updateFormField("media_player", ev.target.value)}
                >
                  <option value="" ?selected=${!currentMediaPlayer}>Select a player</option>
                  ${selectMediaPlayers.map(
                    (entry) => html`<option
                        value=${entry.entity_id}
                        ?selected=${entry.entity_id === currentMediaPlayer}
                      >
                        ${entry.label}
                      </option>`
                  )}
                </select>
              </label>
              ${isSpotifyPlayer
                ? html`<label class="field span-2">
                    <span>Spotify source</span>
                    ${spotifyMissingSources
                      ? html`<div class="form-error">Spotify sources are unavailable for this player.</div>`
                      : html`<select
                          .value=${spotifySourceValue}
                          @change=${(ev) => this._updateFormField("spotify_source", ev.target.value)}
                        >
                          <option value="" ?selected=${!spotifySourceValue}>Select a source</option>
                          ${spotifySources.map(
                            (source) => html`<option value=${source} ?selected=${source === spotifySourceValue}>${source}</option>`
                          )}
                        </select>`}
                  </label>`
                : nothing}
              <label class="field span-2">
                <span>Media source</span>
                <div class="media-input-group">
                  <input
                    type="text"
                    .value=${this._formData.sound_media_id}
                    placeholder="media-source://media_source/local/Alarms/birds.mp3"
                    @input=${(ev) => this._updateFormField("sound_media_id", ev.target.value)}
                  />
                  ${this._renderMediaPreviewControls()}
                  <button
                    class="media-picker-button"
                    type="button"
                    title=${browseTooltip}
                    @click=${this._openMediaPicker}
                    ?disabled=${!this._formData.media_player || !browseSupported}
                    aria-label="Browse media"
                  >
                    <ha-icon icon="mdi:music-note-plus"></ha-icon>
                  </button>
                </div>
                ${this._previewError ? html`<div class="preview-error">${this._previewError}</div>` : nothing}
              </label>
              <label class="field span-2">
                <span>Display title</span>
                <input
                  type="text"
                  .value=${mediaTitleValue}
                  placeholder="Displayed name"
                  @input=${(ev) => this._updateFormField("sound_media_title", ev.target.value)}
                  ?disabled=${!hasMediaSelection}
                />
              </label>
              <label class="field span-2">
                <span>Activation entity</span>
                ${activationOptions.length
                  ? html`<select
                      .value=${this._formData.activation_entity || ""}
                      @change=${(ev) => this._updateFormField("activation_entity", ev.target.value)}
                    >
                      <option value="">None</option>
                      ${activationOptions.map(
                        (entity) => html`<option
                            value=${entity.value}
                            ?selected=${entity.value === (this._formData.activation_entity || "")}
                          >
                            ${entity.label}
                          </option>`
                      )}
                    </select>`
                  : html`<input
                      type="text"
                      placeholder="Optional, add via integration configuration to enable"
                      .value=${this._formData.activation_entity || ""}
                      @input=${(ev) => this._updateFormField("activation_entity", ev.target.value)}
                    />`}
              </label>
            </div>
            ${isSpotifyPlayer
              ? nothing
              : html`<div class="switch-row">
                  <label class="toggle">
                    <input
                      type="checkbox"
                      .checked=${this._formData.announce_time}
                      @change=${(ev) => this._updateFormField("announce_time", ev.target.checked)}
                    />
                    <span>Announce time</span>
                  </label>
                  <label class="toggle">
                    <input
                      type="checkbox"
                      .checked=${this._formData.announce_name}
                      @change=${(ev) => this._updateFormField("announce_name", ev.target.checked)}
                    />
                    <span>Announce name</span>
                  </label>
                </div>`}
          </div>
          <div class="dialog-actions">
            ${isEdit
              ? html`<button class="danger" type="button" ?disabled=${this._saving} @click=${this._deleteAlarm}>
                  Delete
                </button>`
              : html`<span></span>`}
            <div class="dialog-actions-right">
              <button class="text-button" type="button" ?disabled=${this._saving} @click=${this._handleDialogCancel}>
                Cancel
              </button>
              <button class="primary" type="button" ?disabled=${this._saving || formBlocked} @click=${this._submitForm}>
                ${this._saving ? "Saving?" : isEdit ? "Save Changes" : "Create alarm"}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  _renderMediaBrowserDialog() {
    if (!this._mediaBrowserOpen) {
      return nothing;
    }
    const playerLabel = this._mediaBrowserTarget ? this._formatMediaPlayerLabel(this._mediaBrowserTarget) : "";
    const breadcrumbs = this._mediaBrowserBreadcrumbs || [];
  const support = this._mediaSearchSupport;
  const supportsSearch = !!support && !this._mediaSearchUnavailable.has(support);
    const mode = supportsSearch && this._mediaBrowserMode === "search" ? "search" : "browse";
    const heading = mode === "search" ? "Search media" : "Browse media";
    return html`
      <div class="dialog-backdrop media-browser-layer" @click=${this._closeMediaBrowser}>
        <div class="dialog-panel media-browser" role="dialog" aria-modal="true" @click=${(ev) => ev.stopPropagation()}>
          <div class="dialog-header media-browser-header">
            <div class="media-browser-title">
              <h2>${heading}</h2>
              ${playerLabel ? html`<div class="media-browser-subtitle">Target: ${playerLabel}</div>` : nothing}
            </div>
            <div class="dialog-header-actions">
              ${supportsSearch
                ? html`
                    <div class="media-mode-toggle" role="tablist" aria-label="Choose media mode">
                      <button
                        class=${classMap({ "mode-button": true, active: mode === "browse" })}
                        type="button"
                        @click=${() => this._setMediaBrowserMode("browse")}
                        ?disabled=${mode === "browse"}
                      >
                        Browse
                      </button>
                      <button
                        class=${classMap({ "mode-button": true, active: mode === "search" })}
                        type="button"
                        @click=${() => this._setMediaBrowserMode("search")}
                        ?disabled=${mode === "search"}
                      >
                        Search
                      </button>
                    </div>
                  `
                : nothing}
              <button class="icon-button" type="button" @click=${this._closeMediaBrowser} aria-label="Close media browser">
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>
          <div class="media-browser-breadcrumbs">
            ${breadcrumbs.map(
              (crumb, index) => html`
                <button
                  class=${classMap({ crumb: true, active: index === breadcrumbs.length - 1 })}
                  type="button"
                  ?disabled=${index === breadcrumbs.length - 1}
                  @click=${() => this._handleMediaBreadcrumbClick(index)}
                >
                  ${crumb.title || "Library"}
                </button>
                ${index < breadcrumbs.length - 1 ? html`<span class="crumb-sep">/</span>` : nothing}
              `
            )}
            <button
              class="crumb back-button"
              type="button"
              ?disabled=${breadcrumbs.length <= 1}
              @click=${this._handleMediaBack}
            >
              <ha-icon icon="mdi:arrow-left" class="back-icon"></ha-icon>
              <span>Back</span>
            </button>
          </div>
          ${mode === "search" ? this._renderMediaSearchPanel(support) : nothing}
          ${mode === "search" ? this._renderMediaSearchResults() : this._renderMediaBrowseResults()}
        </div>
      </div>
    `;
  }
  _renderMediaBrowseResults() {
    if (this._mediaBrowserError) {
      return html`<div class="form-error">${this._mediaBrowserError}</div>`;
    }
    if (this._mediaBrowserLoading) {
      return html`<div class="media-browser-loading">Loading media...</div>`;
    }
    if (this._mediaBrowserItems.length) {
      return html`<div class="media-browser-grid">
        ${this._mediaBrowserItems.map((item) => this._renderMediaBrowserItem(item))}
      </div>`;
    }
    return html`<div class="media-browser-empty">No media available for this player.</div>`;
  }
  _renderMediaSearchPanel(kind) {
    const query = this._mediaSearchQuery || "";
    const options = this._mediaSearchOptions || this._defaultMediaSearchOptions(kind);
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 20;
    const libraryOnly = !!options.libraryOnly;
    const mediaType = options.mediaType || (kind === "music_assistant" ? "track" : "audio");
    const searching = this._mediaSearchLoading;
    const disableSearch = searching || !query.trim();
    const typeOptions = ["track", "album", "playlist", "artist", "radio"];
    return html`
      <div class="media-search-panel">
        <div class="media-search-input-row">
          <input
            class="media-search-input"
            type="search"
            placeholder="Search media"
            .value=${query}
            @input=${this._handleMediaSearchInput}
            @keydown=${this._handleMediaSearchKeydown}
            ?disabled=${searching}
          />
          ${query
            ? html`<button class="text-button" type="button" @click=${this._clearMediaSearchQuery} ?disabled=${searching}>
                Clear
              </button>`
            : nothing}
          <button class="primary" type="button" @click=${this._handleMediaSearchSubmit} ?disabled=${disableSearch}>
            ${searching ? "Searching..." : "Search"}
          </button>
        </div>
        <div class="media-search-secondary-row">
          <label class="media-search-option">
            <span>Limit</span>
            <input
              type="number"
              min="1"
              max="100"
              .value=${limit}
              @input=${(ev) => this._handleMediaSearchOptionChange("limit", ev.target.value)}
              ?disabled=${searching}
            />
          </label>
          ${kind === "music_assistant"
            ? html`
                <label class="media-search-option">
                  <span>Type</span>
                  <select
                    .value=${mediaType}
                    @change=${(ev) => this._handleMediaSearchOptionChange("mediaType", ev.target.value)}
                    ?disabled=${searching}
                  >
                    ${typeOptions.map((option) => {
                      const label = option.charAt(0).toUpperCase() + option.slice(1);
                      return html`<option value=${option}>${label}</option>`;
                    })}
                  </select>
                </label>
                <label class="media-search-option media-search-checkbox">
                  <input
                    type="checkbox"
                    .checked=${libraryOnly}
                    @change=${(ev) => this._handleMediaSearchOptionChange("libraryOnly", ev.target.checked)}
                    ?disabled=${searching}
                  />
                  <span>Library only</span>
                </label>
              `
            : nothing}
        </div>
      </div>
    `;
  }
  _renderMediaSearchResults() {
    if (this._mediaSearchLoading) {
      return html`<div class="media-browser-loading">Searching...</div>`;
    }
    const meta = this._renderMediaSearchMeta();
    if (this._mediaSearchError) {
      return html`
        ${meta}
        <div class="form-error">${this._mediaSearchError}</div>
      `;
    }
    if (!this._mediaSearchPerformed) {
      return html`<div class="media-browser-empty">Enter a search term to get started.</div>`;
    }
    if (!this._mediaSearchResults.length) {
      return html`
        ${meta}
        <div class="media-browser-empty">No results found.</div>
      `;
    }
    return html`
      ${meta}
      <div class="media-browser-grid search-results">
        ${this._mediaSearchResults.map((item) => this._renderMediaBrowserItem(item))}
      </div>
    `;
  }
  _setMediaBrowserMode(mode) {
    if (mode === this._mediaBrowserMode) {
      return;
    }
    if (mode === "search") {
      const support = this._mediaSearchSupport ?? this._detectMediaSearchSupport(this._mediaBrowserTarget);
      if (!support) {
        this._notify("Search is not available for this player", true);
        return;
      }
      if (this._mediaSearchUnavailable.has(support)) {
        this._notify("Search is not supported for this player in your Home Assistant version", true);
        return;
      }
      if (!this._mediaSearchSupport) {
        this._mediaSearchSupport = support;
      }
      if (!this._mediaSearchOptions) {
        this._mediaSearchOptions = this._defaultMediaSearchOptions(this._mediaSearchSupport);
      }
      this._mediaBrowserMode = "search";
      return;
    }
    this._mediaBrowserMode = "browse";
  }
  _handleMediaSearchInput = (ev) => {
    if (!ev || !ev.target) {
      return;
    }
    this._mediaSearchQuery = ev.target.value ?? "";
  };
  _handleMediaSearchKeydown = (ev) => {
    if (ev?.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      this._handleMediaSearchSubmit();
    }
  };
  _handleMediaSearchSubmit = () => {
    void this._performMediaSearch();
  };
  _clearMediaSearchQuery = () => {
    this._mediaSearchQuery = "";
    this._mediaSearchError = "";
    this._mediaSearchResults = [];
    this._mediaSearchPerformed = false;
    this._mediaSearchTelemetry = null;
  };
  _handleMediaSearchOptionChange(field, rawValue) {
    const base = this._mediaSearchOptions || this._defaultMediaSearchOptions(this._mediaSearchSupport);
    const next = { ...base };
    if (field === "limit") {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed)) {
        next.limit = Math.max(1, Math.min(100, Math.round(parsed)));
      }
    } else if (field === "mediaType") {
      if (typeof rawValue === "string" && rawValue) {
        next.mediaType = rawValue;
      }
    } else if (field === "libraryOnly") {
      next.libraryOnly = !!rawValue;
    }
    this._mediaSearchOptions = next;
  }
  async _performMediaSearch() {
    if (!this.hass || !this._mediaBrowserTarget) {
      return;
    }
    const query = (this._mediaSearchQuery || "").trim();
    if (!query) {
      this._mediaSearchError = "Enter a search term.";
      this._mediaSearchPerformed = false;
      return;
    }
    const support = this._mediaSearchSupport ?? this._detectMediaSearchSupport(this._mediaBrowserTarget);
    if (!support) {
      this._mediaSearchError = "Search is not supported for this player.";
      this._mediaSearchPerformed = false;
      return;
    }
    this._mediaSearchSupport = support;
    this._mediaSearchLoading = true;
    this._mediaSearchError = "";
    this._mediaSearchPerformed = true;
    this._mediaSearchTelemetry = null;
    try {
      let items = [];
      if (support === "music_assistant") {
        const started = this._now();
        const response = await this._searchMusicAssistant(query, this._mediaSearchOptions);
        items = this._mapMusicAssistantSearchResponse(response, this._mediaSearchOptions);
        this._recordMediaSearchTelemetry("music_assistant.search", {
          resultCount: Array.isArray(items) ? items.length : 0,
          durationMs: this._durationMs(started),
        });
      } else {
        const started = this._now();
        items = await this._searchMediaSource(query, this._mediaSearchOptions, started);
        if (!this._mediaSearchTelemetry) {
          this._recordMediaSearchTelemetry("media_player/search_media", {
            resultCount: Array.isArray(items) ? items.length : 0,
            durationMs: this._durationMs(started),
          });
        }
      }
      this._mediaSearchResults = Array.isArray(items) ? items : [];
    } catch (error) {
      console.warn("Media search failed", error);
      if (!this._mediaSearchTelemetry) {
        const code = error?.code || error?.error?.code;
        const transport = support === "music_assistant" ? "music_assistant.search" : "media_player/search_media";
        this._recordMediaSearchTelemetry(transport, {
          status: "error",
          errorCode: code,
          errorMessage: error?.message || "Search failed",
        });
      }
      if (error?.code === "unsupported_search") {
        const message = error?.message || "Media search is not supported by this Home Assistant version.";
        const blockedSupport =
          error?.support || this._mediaSearchSupport || this._detectMediaSearchSupport(this._mediaBrowserTarget) || "media_source";
        if (blockedSupport) {
          const nextUnavailable = new Set(this._mediaSearchUnavailable);
          nextUnavailable.add(blockedSupport);
          this._mediaSearchUnavailable = nextUnavailable;
        }
        this._mediaSearchError = "";
        this._mediaSearchResults = [];
        this._resetMediaSearchState(blockedSupport);
        this._notify(message, true);
      } else {
        this._mediaSearchError = error?.message || "Unable to fetch search results";
        this._mediaSearchResults = [];
      }
    } finally {
      this._mediaSearchLoading = false;
    }
  }
  _detectMediaSearchSupport(entityId) {
    if (!entityId || !this.hass) {
      return null;
    }
    if (!this._playerSupportsMediaBrowser(entityId)) {
      return null;
    }
    const stateObj = this.hass.states?.[entityId];
    if (!stateObj) {
      return null;
    }
    if (stateObj.attributes?.mass_player_type) {
      return "music_assistant";
    }
    return "media_source";
  }
  async _searchMusicAssistant(query, options = {}) {
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 20;
    const mediaType = typeof options.mediaType === "string" && options.mediaType ? options.mediaType : "track";
    const libraryOnly = options.libraryOnly ? true : false;
    const message = {
      type: "call_service",
      domain: "music_assistant",
      service: "search",
      service_data: {
        name: query,
        media_type: mediaType,
        limit,
        library_only: libraryOnly,
      },
      return_response: true,
    };
    const configEntryId = await this._getMusicAssistantConfigEntryId();
    if (configEntryId) {
      message.service_data.config_entry_id = configEntryId;
    }
    return await this.hass.connection.sendMessagePromise(message);
  }
  async _getMusicAssistantConfigEntryId() {
    if (this._musicAssistantConfigEntryId !== undefined) {
      return this._musicAssistantConfigEntryId;
    }
    if (!this.hass) {
      return null;
    }
    if (!this._musicAssistantConfigEntryPromise) {
      this._musicAssistantConfigEntryPromise = this.hass
        .callApi("GET", "config/config_entries/entry")
        .then((entries) => {
          if (Array.isArray(entries)) {
            const entry = entries.find((item) => item?.domain === "music_assistant");
            this._musicAssistantConfigEntryId = entry?.entry_id || null;
          } else {
            this._musicAssistantConfigEntryId = null;
          }
          return this._musicAssistantConfigEntryId;
        })
        .catch((error) => {
          console.warn("Failed to load Music Assistant config entry id", error);
          this._musicAssistantConfigEntryId = null;
          return null;
        });
    }
    const result = await this._musicAssistantConfigEntryPromise;
    this._musicAssistantConfigEntryPromise = null;
    return result;
  }
  _musicAssistantKeyForType(type) {
    switch (type) {
      case "track":
        return "tracks";
      case "album":
        return "albums";
      case "artist":
        return "artists";
      case "playlist":
        return "playlists";
      case "radio":
        return "radio";
      default:
        return "tracks";
    }
  }
  _musicAssistantTypeForKey(key) {
    switch (key) {
      case "tracks":
        return "track";
      case "albums":
        return "album";
      case "artists":
        return "artist";
      case "playlists":
        return "playlist";
      case "radio":
        return "radio";
      default:
        return "music";
    }
  }
  _mapMusicAssistantSearchResponse(response, options = {}) {
    const payload = response?.response || response;
    if (!payload || typeof payload !== "object") {
      return [];
    }
    const requestedKey = this._musicAssistantKeyForType(options.mediaType);
    const order = [];
    if (requestedKey) {
      order.push(requestedKey);
    }
    const keys = ["tracks", "albums", "playlists", "radio", "artists"];
    for (const key of keys) {
      if (!order.includes(key)) {
        order.push(key);
      }
    }
    const items = [];
    for (const key of order) {
      const entries = Array.isArray(payload[key]) ? payload[key] : [];
      const type = this._musicAssistantTypeForKey(key);
      for (const entry of entries) {
        const mapped = this._mapMusicAssistantItem(entry, type);
        if (mapped) {
          items.push(mapped);
        }
      }
    }
    return items;
  }
  _mapMusicAssistantItem(entry, mediaType) {
    if (!entry) {
      return null;
    }
    const id = entry.uri || entry.media_id || entry.media_item_id || entry.media_content_id || entry.id;
    if (!id) {
      return null;
    }
    const normalizedType =
      (typeof entry.media_type === "string" && entry.media_type.trim())
        ? entry.media_type.trim().toLowerCase()
        : (typeof mediaType === "string" && mediaType.trim())
            ? mediaType.trim().toLowerCase()
            : "music";
    const artists = this._extractMusicAssistantArtists(entry);
    const albumName = entry.album?.name || entry.album_name || entry.album || "";
    const baseTitleCandidates = [
      entry.name,
      entry.title,
      entry.metadata?.title,
      entry.metadata?.name,
    ];
    const baseTitleRaw = baseTitleCandidates.find((value) => typeof value === "string" && value.trim());
    const baseTitle = baseTitleRaw ? baseTitleRaw.trim() : formatMediaName(id);
    let title = baseTitle;
    if (title && artists.length && (normalizedType === "track" || normalizedType === "album")) {
      const artistLabel = artists.join(", ");
      const titleLower = title.toLowerCase();
      if (!titleLower.includes(artistLabel.toLowerCase())) {
        title = `${artistLabel} - ${title}`;
      }
    }
    const subtitleParts = [];
    if (artists.length) {
      const artistLabel = artists.join(", ");
      const titleIncludesArtist = title.toLowerCase().includes(artistLabel.toLowerCase());
      if (!titleIncludesArtist || (normalizedType !== "track" && normalizedType !== "album")) {
        subtitleParts.push(artistLabel);
      }
    }
    if (albumName && normalizedType === "track") {
      subtitleParts.push(albumName);
    }
    const subtitle = subtitleParts.length ? subtitleParts.join(" \u00b7 ") : "";
    const expandableTypes = new Set(["album", "artist", "playlist"]);
    const canExpand = expandableTypes.has(normalizedType);
    const item = {
      can_play: true,
      can_expand: canExpand,
      media_content_id: id,
      media_content_type: normalizedType,
      media_class: normalizedType,
      title,
      thumbnail: entry.image || entry.thumbnail || "",
      media_content_provider: entry.provider || entry.provider_name || entry.media_provider || "",
    };
    if (subtitle) {
      item.subtitle = subtitle;
    }
    const metadata = {};
    if (baseTitle) {
      metadata.title = baseTitle;
      metadata.name = baseTitle;
    }
    if (artists.length) {
      metadata.artist = artists[0];
      metadata.artist_name = artists.join(", ");
      metadata.artists = artists;
    }
    if (albumName) {
      metadata.album = albumName;
      metadata.album_name = albumName;
    }
    metadata.media_type = normalizedType;
    if (typeof entry.duration === "number" && Number.isFinite(entry.duration)) {
      metadata.duration = entry.duration;
    }
    if (Object.keys(metadata).length) {
      item.metadata = metadata;
    }
    if (!this._mediaItemLooksAudio(item)) {
      return null;
    }
    return item;
  }
  _extractMusicAssistantArtists(entry) {
    const values = [];
    if (Array.isArray(entry?.artists)) {
      entry.artists.forEach((artist) => {
        if (!artist) {
          return;
        }
        if (typeof artist === "string") {
          const trimmed = artist.trim();
          if (trimmed) {
            values.push(trimmed);
          }
          return;
        }
        const name = artist.name || artist.title || artist.label;
        if (typeof name === "string" && name.trim()) {
          values.push(name.trim());
        }
      });
    }
    if (!values.length) {
      const fallback = entry?.artist || entry?.artist_name;
      if (typeof fallback === "string" && fallback.trim()) {
        values.push(fallback.trim());
      }
    }
    return values;
  }
  async _searchMediaSource(query, options = {}, startedAt = null) {
    if (!this.hass || !this._mediaBrowserTarget) {
      return [];
    }
    const trimmed = typeof query === "string" ? query.trim() : "";
    if (!trimmed) {
      return [];
    }
    const started = typeof startedAt === "number" ? startedAt : this._now();
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 20;
    const rawFilter = Array.isArray(options.filterClasses) && options.filterClasses.length
      ? options.filterClasses
      : Array.isArray(options.filter) && options.filter.length
        ? options.filter
        : MEDIA_SEARCH_FILTER_CLASSES;
    const filterClasses = rawFilter.filter((entry) => typeof entry === "string" && entry.trim());
    const topCrumb = this._mediaBrowserBreadcrumbs?.[0];
    const topDescriptor = (topCrumb?.descriptor && typeof topCrumb.descriptor === "object") ? topCrumb.descriptor : topCrumb;
    const request = {
      type: "media_player/search_media",
      entity_id: this._mediaBrowserTarget,
      search_query: trimmed,
    };
    if (filterClasses.length) {
      request.media_filter_classes = filterClasses;
    }
    const rootId = topDescriptor?.id;
    const rootType = topDescriptor?.type;
    if (rootId !== undefined && rootId !== null && rootType) {
      request.media_content_id = rootId;
      request.media_content_type = rootType;
    }
    try {
      const response = await this.hass.callWS(request);
      const items = this._mapMediaSourceSearchResponse(response) || [];
      if (items.length > limit) {
        items.length = limit;
      }
      this._recordMediaSearchTelemetry("media_player/search_media", {
        resultCount: items.length,
        durationMs: this._durationMs(started),
      });
      return items;
    } catch (error) {
      const code = error?.code || error?.error?.code;
      if (code === "unknown_command" || code === "not_supported") {
        const fallback = await this._searchMediaSourceFallback(trimmed, {
          limit,
          root: rootId,
          filter: filterClasses.length ? filterClasses : MEDIA_SEARCH_FILTER_CLASSES,
        });
        const duration = this._durationMs(started);
        if (Array.isArray(fallback)) {
          if (fallback.length > limit) {
            fallback.length = limit;
          }
          this._recordMediaSearchTelemetry("fallback", {
            baseTransport: "media_player/search_media",
            reason: code || error?.message || "unknown",
            resultCount: fallback.length,
            durationMs: duration,
            status: "fallback",
          });
          return fallback;
        }
        const notSupported = new Error("Media search is not supported by this Home Assistant version.");
        notSupported.code = "unsupported_search";
        notSupported.support = "media_source";
        this._recordMediaSearchTelemetry("media_player/search_media", {
          status: "error",
          errorCode: "unsupported_search",
          errorMessage: notSupported.message,
          durationMs: duration,
        });
        throw notSupported;
      }
      this._recordMediaSearchTelemetry("media_player/search_media", {
        status: "error",
        errorCode: code,
        errorMessage: error?.message || "Search failed",
        durationMs: this._durationMs(started),
      });
      throw error;
    }
  }
  // Crawl the media tree when the websocket search command is unavailable.
  async _searchMediaSourceFallback(query, options = {}) {
    if (!this.hass || !this._mediaBrowserTarget) {
      return [];
    }
    const trimmed = typeof query === "string" ? query.trim() : "";
    if (!trimmed) {
      return [];
    }
    const normalizedQuery = trimmed.toLowerCase();
    const limit = Number(options.limit) > 0 ? Number(options.limit) : 20;
    const filters = Array.isArray(options.filter)
      ? options.filter.map((entry) => this._normalizeMediaClass(entry)).filter(Boolean)
      : [];
    const filterSet = filters.length ? new Set(filters) : null;
    const dedupe = new Set();
    const results = [];
    const queued = new Set();
    const visited = new Set();
    const pending = [];
    const maxDepth = Math.max(2, MEDIA_PROBE_MAX_DEPTH + 1);
    const maxVisits = 80;
    const seeds = [];
    const rootCrumb = this._mediaBrowserBreadcrumbs?.[0];
    if (options.root) {
      seeds.push({ id: options.root, type: undefined });
    }
    if (rootCrumb) {
      seeds.push(rootCrumb.descriptor || rootCrumb);
    }
    if (this._mediaBrowserBreadcrumbs?.length) {
      const currentCrumb = this._mediaBrowserBreadcrumbs[this._mediaBrowserBreadcrumbs.length - 1];
      if (currentCrumb) {
        seeds.push(currentCrumb.descriptor || currentCrumb);
      }
    }
    if (!seeds.length) {
      seeds.push({});
    }
    const enqueueDescriptor = (descriptor, depth = 0) => {
      const normalized = this._normalizeMediaDescriptor(descriptor || {});
      const key = `${normalized.id || "__root__"}|${normalized.type || ""}`;
      if (queued.has(key) || visited.has(key)) {
        return;
      }
      queued.add(key);
      pending.push({ descriptor: normalized, depth });
    };
    const attemptAddResult = (item) => {
      if (!item || !item.can_play || !this._mediaItemLooksAudio(item)) {
        return;
      }
      if (filterSet) {
        const mediaClass = this._normalizeMediaClass(item.media_class);
        const mediaType = this._normalizeMediaClass(item.media_content_type);
        if (
          (mediaClass && filterSet.has(mediaClass)) ||
          (mediaType && filterSet.has(mediaType)) ||
          (!mediaClass && !mediaType)
        ) {
          // allow
        } else {
          return;
        }
      }
      const key = item.media_content_id ? this._normalizeMediaId(item.media_content_id) : "";
      if (key && dedupe.has(key)) {
        return;
      }
      if (!this._mediaSourceItemMatchesQuery(item, normalizedQuery)) {
        return;
      }
      if (key) {
        dedupe.add(key);
      }
      results.push(item);
    };
    const processChildren = (children, depth) => {
      if (!Array.isArray(children)) {
        return;
      }
      for (const child of children) {
        if (!child) {
          continue;
        }
        if (child.can_expand && depth < maxDepth && !this._mediaItemLooksEmpty(child)) {
          enqueueDescriptor({ id: child.media_content_id, type: child.media_content_type }, depth + 1);
        }
        attemptAddResult(child);
        if (results.length >= limit) {
          break;
        }
      }
    };
    seeds.forEach((seed) => enqueueDescriptor(seed, 0));
    processChildren(this._mediaBrowserItems, 0);
    while (pending.length && results.length < limit && visited.size < maxVisits) {
      const next = pending.shift();
      if (!next) {
        continue;
      }
      const descriptor = next.descriptor || {};
      const key = `${descriptor.id || "__root__"}|${descriptor.type || ""}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      let response;
      try {
        response = await this._callMediaBrowser(descriptor);
      } catch (err) {
        continue;
      }
      const children = Array.isArray(response?.children) ? response.children : [];
      processChildren(children, next.depth);
    }
    if (results.length > limit) {
      results.length = limit;
    }
    return results;
  }
  _mediaSourceItemMatchesQuery(item, normalizedQuery) {
    if (!item || !normalizedQuery) {
      return false;
    }
    const haystacks = [];
    const pushValue = (value) => {
      if (typeof value === "string" && value.trim()) {
        haystacks.push(value.trim().toLowerCase());
      }
    };
    pushValue(item.title);
    pushValue(item.subtitle);
    pushValue(item.artist);
    pushValue(item.artist_name);
    pushValue(item.album);
    pushValue(item.album_name);
    pushValue(item.media_content_id);
    if (item.metadata && typeof item.metadata === "object") {
      Object.values(item.metadata).forEach((metaValue) => pushValue(metaValue));
    }
    const formatted = formatMediaName(item.media_content_id);
    pushValue(formatted);
    if (!haystacks.length) {
      return false;
    }
    return haystacks.some((value) => value.includes(normalizedQuery));
  }
  _mapMediaSourceSearchResponse(response) {
    const candidates = [];
    if (Array.isArray(response)) {
      candidates.push(...response);
    }
    if (Array.isArray(response?.result)) {
      candidates.push(...response.result);
    }
    if (Array.isArray(response?.media)) {
      candidates.push(...response.media);
    }
    if (Array.isArray(response?.items)) {
      candidates.push(...response.items);
    }
    if (Array.isArray(response?.children)) {
      candidates.push(...response.children);
    }
    const seen = new Set();
    const items = [];
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const id = candidate.media_content_id || candidate.id || candidate.mediaId;
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const type = candidate.media_content_type || candidate.media_class || "";
      const subtitleParts = [];
      const artist = candidate.artist || candidate.artist_name;
      const album = candidate.album || candidate.album_name;
      if (typeof artist === "string" && artist.trim()) {
        subtitleParts.push(artist.trim());
      }
      if (typeof album === "string" && album.trim()) {
        subtitleParts.push(album.trim());
      }
      if (!subtitleParts.length && type) {
        subtitleParts.push(this._formatMediaContentTypeLabel(type));
      }
      const canPlay = candidate.can_play !== undefined ? !!candidate.can_play : true;
      const canExpand = candidate.can_expand !== undefined ? !!candidate.can_expand : false;
      const item = {
        can_play: canPlay,
        can_expand: canExpand,
        media_content_id: id,
        media_content_type: type,
        media_class: candidate.media_class || type || "music",
        title: candidate.title || formatMediaName(id),
        thumbnail: candidate.thumbnail || candidate.image || "",
        media_content_provider: candidate.media_content_provider || candidate.provider || "",
      };
      if (subtitleParts.length) {
        item.subtitle = subtitleParts.join(" \u00b7 ");
      }
      if (artist) {
        item.artist = artist;
        item.artist_name = artist;
      }
      if (album) {
        item.album = album;
        item.album_name = album;
      }
      if (candidate.metadata && typeof candidate.metadata === "object") {
        item.metadata = { ...candidate.metadata };
      }
      if (this._shouldDisplayMediaItem(item) === "include" || (!item.can_expand && this._mediaItemLooksAudio(item))) {
        items.push(item);
      }
    }
    return items;
  }
  _now() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  }
  _durationMs(start) {
    if (typeof start !== "number" || Number.isNaN(start)) {
      return undefined;
    }
    const elapsed = this._now() - start;
    return Math.max(0, Math.round(elapsed));
  }
  _recordMediaSearchTelemetry(transport, data = {}) {
    const payload = { transport, ...data };
    if (typeof payload.started === "number" && payload.durationMs === undefined) {
      payload.durationMs = this._durationMs(payload.started);
      delete payload.started;
    }
    if (typeof payload.durationMs === "number") {
      payload.durationMs = Math.max(0, Math.round(payload.durationMs));
    }
    if (!payload.status) {
      if (payload.transport === "fallback") {
        payload.status = "fallback";
      } else if (payload.errorCode || payload.errorMessage) {
        payload.status = "error";
      } else {
        payload.status = "success";
      }
    }
    this._mediaSearchTelemetry = payload;
  }
  _labelMediaSearchTransport(transport) {
    switch (transport) {
      case "media_player/search_media":
        return "Home Assistant search";
      case "music_assistant.search":
        return "Music Assistant search";
      case "fallback":
        return "Fallback crawler";
      default:
        return transport || "";
    }
  }
  _renderMediaSearchMeta() {
    const telemetry = this._mediaSearchTelemetry;
    if (!telemetry) {
      return nothing;
    }
    const segments = [];
    const label = this._labelMediaSearchTransport(telemetry.transport);
    if (label) {
      segments.push(label);
    }
    if (telemetry.transport === "fallback" && telemetry.baseTransport) {
      const baseLabel = this._labelMediaSearchTransport(telemetry.baseTransport);
      if (baseLabel) {
        segments.push(`Primary: ${baseLabel}`);
      }
    }
    if (typeof telemetry.resultCount === "number") {
      const count = telemetry.resultCount;
      segments.push(`${count} ${count === 1 ? "result" : "results"}`);
    }
    if (typeof telemetry.durationMs === "number") {
      segments.push(`${telemetry.durationMs} ms`);
    }
    if (telemetry.reason) {
      segments.push(`Reason: ${telemetry.reason}`);
    } else if (telemetry.errorCode) {
      segments.push(`Error: ${telemetry.errorCode}`);
    }
    if (telemetry.errorMessage && !telemetry.reason) {
      segments.push(telemetry.errorMessage);
    }
    if (!segments.length) {
      return nothing;
    }
    const parts = [];
    segments.forEach((segment, index) => {
      parts.push(html`<span>${segment}</span>`);
      if (index < segments.length - 1) {
        parts.push(html`<span class="media-search-telemetry-sep">&bull;</span>`);
      }
    });
    return html`<div class="media-search-telemetry">${parts}</div>`;
  }
  _renderMediaBrowserItem(item) {
    const classes = classMap({
      "media-item": true,
      folder: item.can_expand && !item.can_play,
      hybrid: item.can_expand && item.can_play,
      playable: item.can_play,
    });
    const title = item.title || formatMediaName(item.media_content_id);
    const showHybridSelect = !!(item.can_expand && item.can_play);
    const openHandler = () => this._handleMediaItemClick(item, { fromSearch: this._mediaBrowserMode === "search" });
    const selectHandler = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      this._selectMediaItem(item);
    };
    const fallbackIcon = item.can_expand ? "mdi:folder-music" : "mdi:music-note";
    const thumbnail = this._mediaItemThumbnail(item);
    const icon = this._mediaItemIcon(item, fallbackIcon);
    return html`
      <div class="media-item-wrapper">
        <button class=${classes} type="button" @click=${openHandler}>
          <div class="media-thumb">
            ${thumbnail
              ? html`<img src=${thumbnail} alt="" loading="lazy" />`
              : html`<ha-icon icon=${icon}></ha-icon>`}
          </div>
          <div class="media-copy">
            <div class="media-title">${title}</div>
          </div>
        </button>
        ${showHybridSelect
          ? html`<button class="media-item-select-button" type="button" aria-label="Select" @click=${selectHandler}></button>`
          : nothing}
      </div>
    `;
  }
  _handleDialogCancel = () => {
    if (!this._saving) {
      this._closeDialog();
    }
  };
  _mediaItemThumbnail(item) {
    if (!item) {
      return "";
    }
    const raw = item.thumbnail || item.image || "";
    if (!raw) {
      return "";
    }
    if (this._mediaItemPrefersIcon(item)) {
      const brandIcon = this._mediaItemBrandsIcon(raw);
      if (brandIcon) {
        return brandIcon;
      }
      return "";
    }
    return raw;
  }
  _mediaItemPrefersIcon(item) {
    if (!item) {
      return false;
    }
    const mediaClass = typeof item.media_class === "string" ? item.media_class.toLowerCase() : "";
    const mediaType = typeof item.media_content_type === "string" ? item.media_content_type.toLowerCase() : "";
    if (mediaClass === "app" || mediaType === "app") {
      return true;
    }
    if (mediaType === "plex" && !item.can_play) {
      return true;
    }
    return false;
  }
  _mediaItemBrandsIcon(thumbnailUrl) {
    if (typeof thumbnailUrl !== "string" || !thumbnailUrl) {
      return "";
    }
    const match = thumbnailUrl.match(/^https?:\/\/brands\.home-assistant\.io\/_\/([^/]+)\/logo\.png$/i);
    if (!match || !match[1]) {
      return "";
    }
    const slug = match[1];
    return `https://brands.home-assistant.io/_/${slug}/icon.png`;
  }
  _mediaItemIcon(item, fallback = "mdi:music-note") {
    const provider = typeof item?.media_content_provider === "string" ? item.media_content_provider.toLowerCase() : "";
    if (provider.includes("plex")) {
      return "mdi:plex";
    }
    const title = typeof item?.title === "string" ? item.title.toLowerCase() : "";
    if (title.includes("plex")) {
      return "mdi:plex";
    }
    if (this._mediaItemPrefersIcon(item)) {
      return "mdi:application";
    }
    return fallback;
  }
  _openMediaPicker = async () => {
    const player = this._formData.media_player;
    if (!this.hass) {
      return;
    }
    if (!player) {
      this._notify("Select a media player first", true);
      return;
    }
    if (!this._playerSupportsMediaBrowser(player)) {
      this._notify("Media browser isn't supported for this Spotify media player. Enter a Spotify URI manually.", true);
      return;
    }
  const searchSupport = this._detectMediaSearchSupport(player);
  this._resetMediaSearchState(searchSupport);
  const initialInfo = this._getInitialMediaBrowserPath();
  const initialPath = Array.isArray(initialInfo.path) ? initialInfo.path : [];
  const attemptedRestore = initialPath.length > 0;
  this._mediaBrowserTarget = player;
    this._mediaBrowserError = "";
    this._mediaBrowserItems = [];
    this._mediaBrowserBreadcrumbs = [];
  this._mediaBrowserCurrentContextKey = "";
  this._mediaBrowserLastChildren = [];
    this._mediaBrowserOpen = true;
    await this._navigateMediaBrowser(undefined, 0, true);
    if (!this._mediaBrowserOpen) {
      return;
    }
    if (initialPath.length) {
      for (const descriptor of initialPath) {
        if (!descriptor?.id) {
          continue;
        }
        const targetId = this._normalizeMediaBrowserId(descriptor.id) || descriptor.id;
        const lastCrumb = this._mediaBrowserBreadcrumbs[this._mediaBrowserBreadcrumbs.length - 1];
        const lastId = lastCrumb?.descriptor?.id || lastCrumb?.id || "";
        if (targetId && lastId && targetId === lastId) {
          continue;
        }
        await this._navigateMediaBrowser(descriptor);
        if (!this._mediaBrowserOpen || this._mediaBrowserError) {
          break;
        }
      }
    }
    if (attemptedRestore && this._mediaBrowserError) {
      if (Array.isArray(initialInfo.keys)) {
        initialInfo.keys.forEach((key) => {
          if (key) {
            this._mediaBrowserSelectionPaths.delete(key);
          }
        });
      }
      const priorError = this._mediaBrowserError;
      await this._navigateMediaBrowser(undefined, 0, true);
      if (!this._mediaBrowserError) {
        this._notify("Showing library root; previous media location unavailable", true);
      } else {
        this._mediaBrowserError = priorError;
      }
      return;
    }
    if (
      attemptedRestore &&
      !this._mediaBrowserError &&
      initialInfo.pathSource === "descriptor" &&
      initialInfo.canonicalId
    ) {
      this._recordMediaBrowserPathForSelection(initialInfo.canonicalId, initialInfo.mediaType, initialPath);
    }
  };
  _closeMediaBrowser = () => {
    this._mediaBrowserOpen = false;
    this._mediaBrowserLoading = false;
    this._mediaBrowserError = "";
    this._mediaBrowserItems = [];
    this._mediaBrowserBreadcrumbs = [];
    this._mediaBrowserTarget = "";
    this._mediaBrowserLastChildren = [];
    this._mediaBrowserCurrentContextKey = "";
    this._resetMediaSearchState();
  };
  _resetMediaSearchState(kind = null) {
    this._mediaBrowserMode = "browse";
    this._mediaSearchQuery = "";
    this._mediaSearchResults = [];
    this._mediaSearchError = "";
    this._mediaSearchLoading = false;
    this._mediaSearchPerformed = false;
  this._mediaSearchTelemetry = null;
    const requestedSupport = kind ?? this._mediaSearchSupport ?? null;
    const blocked = requestedSupport && this._mediaSearchUnavailable.has(requestedSupport);
    const support = blocked ? null : requestedSupport;
    this._mediaSearchSupport = support;
    this._mediaSearchOptions = this._defaultMediaSearchOptions(support);
  }
  _defaultMediaSearchOptions(kind = null) {
    if (kind === "music_assistant") {
      return {
        mediaType: "track",
        limit: 20,
        libraryOnly: false,
      };
    }
    return {
      mediaType: "audio",
      limit: 20,
    };
  }
  async _navigateMediaBrowser(mediaDescriptor = undefined, breadcrumbIndex = null, reset = false) {
    if (!this.hass || !this._mediaBrowserTarget) {
      return;
    }
    const descriptor = this._normalizeMediaDescriptor(mediaDescriptor);
    this._mediaBrowserLoading = true;
    this._mediaBrowserError = "";
    try {
    const response = await this._callMediaBrowser(descriptor);
    const rawChildren = Array.isArray(response?.children) ? response.children : [];
    const descriptorId = descriptor?.id || descriptor?.media_content_id;
    if (descriptorId && descriptorId.startsWith("media-source://jellyfin/")) {
      this._debugJellyfin("Media browser child payload", {
        descriptor: this._summarizeJellyfinDescriptor(descriptor),
        childCount: rawChildren.length,
        sampleChildren: this._summarizeMediaItems(rawChildren, 10),
        responseTitle: response?.title,
      });
    }
      const resolvedId = response?.media_content_id ?? descriptor.id ?? undefined;
      let resolvedType = response?.media_content_type || descriptor.type || undefined;
      if (!resolvedId) {
        resolvedType = undefined;
      }
      const resolvedTitle = response?.title || (resolvedId ? formatMediaName(resolvedId.split("/").pop()) : "Library");
      const contextDescriptor = { id: resolvedId, type: resolvedType };
      const contextKey = this._buildMediaBrowserContextKey(contextDescriptor);
      this._mediaBrowserCurrentContextKey = contextKey;
      this._mediaBrowserLastChildren = rawChildren;
      const filteredChildren = this._filterMediaItems(rawChildren, contextKey);
      this._mediaBrowserItems = filteredChildren;
      if (reset || !this._mediaBrowserBreadcrumbs.length) {
        this._mediaBrowserBreadcrumbs = [
          {
            id: resolvedId,
            type: resolvedType,
            descriptor: { id: resolvedId, type: resolvedType },
            title: response?.title || "Library",
          },
        ];
      } else if (breadcrumbIndex !== null && breadcrumbIndex >= 0) {
        const next = this._mediaBrowserBreadcrumbs.slice(0, breadcrumbIndex + 1);
        next[breadcrumbIndex] = {
          id: resolvedId,
          type: resolvedType,
          descriptor: { id: resolvedId, type: resolvedType },
          title: resolvedTitle,
        };
        this._mediaBrowserBreadcrumbs = next;
      } else {
        this._mediaBrowserBreadcrumbs = [
          ...this._mediaBrowserBreadcrumbs,
          {
            id: resolvedId,
            type: resolvedType,
            descriptor: { id: resolvedId, type: resolvedType },
            title: resolvedTitle,
          },
        ];
      }
    } catch (err) {
      this._mediaBrowserError = err?.message || "Unable to load media";
      this._mediaBrowserItems = [];
    } finally {
      this._mediaBrowserLoading = false;
    }
  }
  async _callMediaBrowser(descriptor, targetOverride = null) {
    const entityId = targetOverride || this._mediaBrowserTarget;
    if (!this.hass || !entityId) {
      throw new Error("Media browser unavailable");
    }
    const request = {
      type: "media_player/browse_media",
      entity_id: entityId,
    };
    const normalized = this._normalizeMediaDescriptor(descriptor);
    const normalizedId = typeof normalized.id === "string" ? normalized.id.trim() : "";
    const normalizedType = typeof normalized.type === "string" ? normalized.type.trim() : "";
    const isJellyfinRequest = normalizedId?.startsWith("media-source://jellyfin/");
    if (isJellyfinRequest) {
      this._debugJellyfin("Media browser request prepared", {
        target: entityId,
        descriptor: this._summarizeJellyfinDescriptor(normalized),
        via: "media_player",
      });
    }
    if (normalizedId && !normalizedType) {
      const directId = normalizedId.startsWith("media-source://") ? normalizedId : this._convertProviderUriToMediaSource(normalizedId);
      if (directId) {
        if (isJellyfinRequest) {
          this._debugJellyfin("Media browser redirecting to media_source due to missing type", {
            mediaId: normalizedId,
          });
        }
        return await this.hass.callWS({
          type: "media_source/browse_media",
          media_content_id: directId,
        });
      }
    }
    if (normalizedId) {
      request.media_content_id = normalizedId;
      if (normalizedType) {
        request.media_content_type = normalizedType;
      }
    }
    try {
      const response = await this.hass.callWS(request);
      if (isJellyfinRequest) {
        this._debugJellyfin("Media browser response received", {
          via: "media_player",
          descriptor: this._summarizeJellyfinDescriptor(normalized),
          childCount: Array.isArray(response?.children) ? response.children.length : 0,
          sampleChildren: this._summarizeMediaItems(response?.children),
        });
      }
      return response;
    } catch (err) {
      if (isJellyfinRequest) {
        this._debugJellyfin("media_player/browse_media threw", {
          error: err?.message || String(err),
          descriptor: this._summarizeJellyfinDescriptor(normalized),
        });
      }
      const id = descriptor.id;
      if (id && typeof id === "string" && id.startsWith("media-source://")) {
        console.warn("media_player/browse_media failed, trying media_source", err);
        const result = await this.hass.callWS({
          type: "media_source/browse_media",
          media_content_id: id,
        });
        if (isJellyfinRequest) {
          this._debugJellyfin("media_source/browse_media fallback response", {
            descriptor: this._summarizeJellyfinDescriptor(normalized),
            childCount: Array.isArray(result?.children) ? result.children.length : 0,
            sampleChildren: this._summarizeMediaItems(result?.children),
          });
        }
        return result;
      }
      const converted = this._convertProviderUriToMediaSource(id);
      if (converted) {
        try {
          const result = await this.hass.callWS({
            type: "media_source/browse_media",
            media_content_id: converted,
          });
          if (isJellyfinRequest) {
            this._debugJellyfin("Provider URI media_source fallback response", {
              descriptor: this._summarizeJellyfinDescriptor(normalized),
              childCount: Array.isArray(result?.children) ? result.children.length : 0,
              sampleChildren: this._summarizeMediaItems(result?.children),
            });
          }
          return result;
        } catch (fallbackError) {
          console.warn("Provider URI media_source fallback failed", fallbackError);
          if (isJellyfinRequest) {
            this._debugJellyfin("Provider URI media_source fallback failed", {
              descriptor: this._summarizeJellyfinDescriptor(normalized),
              error: fallbackError?.message || String(fallbackError),
            });
          }
        }
      }
      throw err;
    }
  }
  _convertProviderUriToMediaSource(identifier) {
    if (!identifier || typeof identifier !== "string") {
      return "";
    }
    let payload = identifier.trim();
    if (!payload) {
      return "";
    }
    if (/^spotify:\/\//i.test(payload)) {
      payload = payload.replace(/^spotify:\/\//i, "");
    } else if (/^spotify:/i.test(payload)) {
      payload = payload.replace(/^spotify:/i, "");
    } else {
      return "";
    }
    const normalized = payload.replace(/:+/g, "/");
    return normalized ? `media-source://spotify/${normalized}` : "";
  }
  _handleMediaBreadcrumbClick(index) {
    if (index === this._mediaBrowserBreadcrumbs.length - 1) {
      return;
    }
    if (index === 0) {
      this._navigateMediaBrowser(undefined, 0, true);
      return;
    }
    const target = this._mediaBrowserBreadcrumbs[index];
    const descriptor = target?.descriptor || { id: target?.id, type: target?.type };
    if (!descriptor?.id) {
      this._navigateMediaBrowser(undefined, index, true);
      return;
    }
    this._navigateMediaBrowser(descriptor, index, index === 0 && !descriptor.id);
  }
  _handleMediaBack = () => {
    if (this._mediaBrowserBreadcrumbs.length <= 1) {
      return;
    }
    const targetIndex = this._mediaBrowserBreadcrumbs.length - 2;
    if (targetIndex === 0) {
      this._navigateMediaBrowser(undefined, 0, true);
      return;
    }
    const target = this._mediaBrowserBreadcrumbs[targetIndex];
    const descriptor = target?.descriptor || { id: target?.id, type: target?.type };
    if (!descriptor?.id) {
      this._navigateMediaBrowser(undefined, targetIndex, true);
      return;
    }
    this._navigateMediaBrowser(descriptor, targetIndex, targetIndex === 0 && !descriptor.id);
  };
  _handleMediaItemClick(item, options = {}) {
    if (!item) {
      return;
    }
    const fromSearch = options.fromSearch === true;
    if (item.can_expand) {
      const descriptor = this._mediaItemDescriptor(item);
      const normalized = this._normalizeMediaDescriptor(descriptor);
      if (!normalized.id) {
        this._mediaBrowserError = "Unable to open this media source";
        return;
      }
      const promise = this._navigateMediaBrowser(normalized);
      if (fromSearch) {
        Promise.resolve(promise)
          .then(() => {
            if (!this._mediaBrowserError) {
              this._mediaBrowserMode = "browse";
              this._mediaSearchLoading = false;
              this._mediaSearchResults = [];
              this._mediaSearchPerformed = false;
            }
          })
          .catch(() => {
            /* no-op */
          });
      }
    } else if (item.can_play) {
      this._selectMediaItem(item);
    }
  }
  _mediaItemDescriptor(item) {
    if (!item) {
      return { id: undefined, type: undefined };
    }
    const id = this._canonicalMediaItemId(item);
    const type = typeof item.media_content_type === "string" && item.media_content_type.trim() ? item.media_content_type : undefined;
    return {
      id,
      type: id ? type : undefined,
    };
  }
  _canonicalMediaItemId(item) {
    if (!item) {
      return undefined;
    }
    const rawId = typeof item.media_content_id === "string" ? item.media_content_id.trim() : "";
    if (rawId) {
      return item.media_content_id;
    }
    const mediaSource = typeof item.media_source === "string" ? item.media_source.trim() : "";
    if (mediaSource) {
      return item.media_source;
    }
    const mediaType = typeof item.media_content_type === "string" ? item.media_content_type.trim().toLowerCase() : "";
    if (mediaType && MEDIA_TYPE_ID_FALLBACKS[mediaType]) {
      return MEDIA_TYPE_ID_FALLBACKS[mediaType];
    }
    return undefined;
  }
  _normalizeMediaDescriptor(value) {
    if (!value || typeof value === "string") {
      return {
        id: typeof value === "string" && value.trim() ? value.trim() : undefined,
        type: undefined,
      };
    }
    const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : undefined;
    const type = id && typeof value.type === "string" && value.type.trim() ? value.type : undefined;
    return {
      id,
      type,
    };
  }
  _normalizeMediaClass(value) {
    return typeof value === "string" ? value.toLowerCase() : "";
  }
  _normalizeMediaId(value) {
    return typeof value === "string" ? value.toLowerCase() : "";
  }
  _mediaItemLooksEmpty(item) {
    if (!item) {
      return true;
    }
    if (Array.isArray(item.children) && item.children.length === 0) {
      return true;
    }
    if (item.can_expand && !item.can_play) {
      const childrenClass = this._normalizeMediaClass(item.children_media_class);
      const mediaClass = this._normalizeMediaClass(item.media_class);
      if (childrenClass && BLOCKED_MEDIA_CLASS_SET.has(childrenClass)) {
        return true;
      }
      if (mediaClass && BLOCKED_MEDIA_CLASS_SET.has(mediaClass)) {
        return true;
      }
    }
    return false;
  }
  _mediaItemLooksAudio(item) {
    if (!item) {
      return false;
    }
    const mediaClass = this._normalizeMediaClass(item.media_class);
    const contentType = this._normalizeMediaClass(item.media_content_type);
    if (AUDIO_MEDIA_CLASS_SET.has(mediaClass) || AUDIO_CONTENT_TYPE_SET.has(contentType)) {
      return true;
    }
    const id = this._normalizeMediaId(item.media_content_id || item.media_source) || "";
    if (id && AUDIO_FILE_EXTENSION_RE.test(id)) {
      return true;
    }
    if (id && AUDIO_SOURCE_PREFIXES.some((prefix) => id.startsWith(prefix))) {
      return true;
    }
    return false;
  }
  _mediaItemLooksAudioContainer(item) {
    if (!item) {
      return false;
    }
    const childrenClass = this._normalizeMediaClass(item.children_media_class);
    if (childrenClass && AUDIO_MEDIA_CLASS_SET.has(childrenClass)) {
      return true;
    }
    if (this._mediaItemLooksAudio(item)) {
      return true;
    }
    const id = this._normalizeMediaId(item.media_content_id);
    if (id && AUDIO_SOURCE_PREFIXES.some((prefix) => id.startsWith(prefix))) {
      return true;
    }
    return false;
  }
  _mediaItemIsBlocked(item) {
    if (!item) {
      return true;
    }
    const mediaClass = this._normalizeMediaClass(item.media_class);
    const contentType = this._normalizeMediaClass(item.media_content_type);
    const childrenClass = this._normalizeMediaClass(item.children_media_class);
    if (
      BLOCKED_MEDIA_CLASS_SET.has(mediaClass) ||
      BLOCKED_MEDIA_CLASS_SET.has(contentType) ||
      (childrenClass && BLOCKED_MEDIA_CLASS_SET.has(childrenClass))
    ) {
      return true;
    }
      const id = this._normalizeMediaId(item.media_content_id);
      const title = this._normalizeMediaId(item.title);
      if (id && BLOCKED_SOURCE_PREFIXES.some((prefix) => id.startsWith(prefix))) {
        return true;
      }
      if (!item.can_play && id) {
        for (const keyword of BLOCKED_KEYWORD_SET) {
          if (id.includes(keyword)) {
            return true;
          }
        }
      }
      if (!item.can_play && title) {
        for (const keyword of BLOCKED_KEYWORD_SET) {
          if (title.includes(keyword)) {
            return true;
          }
        }
      }
    return false;
  }
  _shouldDisplayMediaItem(item, contextKey = this._mediaBrowserCurrentContextKey) {
    if (!item) {
      return "exclude";
    }
    if (!item.can_play && !item.can_expand) {
      return "exclude";
    }
    if (this._mediaItemIsBlocked(item)) {
      return "exclude";
    }
    if (item.can_play && this._mediaItemLooksAudio(item)) {
      return "include";
    }
    if (item.can_expand && this._mediaItemLooksAudioContainer(item)) {
      return "include";
    }
    if (item.can_play && !this._mediaItemLooksAudio(item)) {
      return "exclude";
    }
    if (item.can_expand && this._mediaItemLooksEmpty(item)) {
      return "exclude";
    }
    if (item.can_expand) {
      return this._decideExpandableWithProbe(item, contextKey);
    }
    return "exclude";
  }
  _filterMediaItems(items, contextKey = this._mediaBrowserCurrentContextKey) {
    if (!Array.isArray(items)) {
      return [];
    }
    const filtered = [];
    const probes = [];
    for (const item of items) {
      this._normalizeMediaItemCapabilities(item);
      const verdict = this._shouldDisplayMediaItem(item, contextKey);
      if (verdict === "include") {
        filtered.push(item);
      } else if (verdict === "probe") {
        probes.push(item);
      }
    }
    if (probes.length) {
      this._queueMediaBrowserProbes(probes, contextKey);
    }
    return filtered;
  }
  _normalizeMediaItemCapabilities(item) {
    if (!item) {
      return;
    }
    const provider = typeof item.media_content_provider === "string" ? item.media_content_provider.toLowerCase() : "";
    const type = this._normalizeMediaClass(item.media_content_type || item.media_class);
    if (!item.can_expand && type === "playlist" && (provider === "spotify" || (typeof item.media_content_id === "string" && item.media_content_id.toLowerCase().startsWith("spotify")))) {
      item.can_expand = true;
    }
  }
  _decideExpandableWithProbe(item, contextKey) {
    const key = this._mediaBrowserProbeKey(item);
    if (!key) {
      return "exclude";
    }
    const cached = this._mediaBrowserProbeCache.get(key);
    if (cached) {
      return cached.allow ? "include" : "exclude";
    }
    const pending = this._mediaBrowserProbePending.get(key);
    if (pending?.contexts instanceof Set && contextKey) {
      pending.contexts.add(contextKey);
    }
    return "probe";
  }
  _queueMediaBrowserProbes(items, contextKey) {
    if (!this.hass || !this._mediaBrowserTarget || !Array.isArray(items) || !items.length) {
      return;
    }
    const target = this._mediaBrowserTarget;
    const seen = new Set();
    for (const item of items) {
      const key = this._mediaBrowserProbeKey(item);
      if (!key || this._mediaBrowserProbeCache.has(key)) {
        continue;
      }
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const existing = this._mediaBrowserProbePending.get(key);
      if (existing) {
        if (contextKey && existing.contexts instanceof Set) {
          existing.contexts.add(contextKey);
        }
        continue;
      }
      const contexts = new Set();
      if (contextKey) {
        contexts.add(contextKey);
      }
      const descriptor = {
        id: item.media_content_id,
        type: item.media_content_type,
      };
      const promise = this._probeMediaBrowserDescriptor(descriptor, target)
        .then((result) => {
          this._mediaBrowserProbeCache.set(key, {
            allow: !!result.hasAudio,
            empty: !!result.empty,
            checkedAt: Date.now(),
          });
          this._handleMediaBrowserProbeCompletion(key, contexts);
        })
        .catch((err) => {
          console.warn("Media browser probe failed", err);
          this._mediaBrowserProbeCache.set(key, {
            allow: false,
            error: true,
            checkedAt: Date.now(),
          });
          this._handleMediaBrowserProbeCompletion(key, contexts);
        })
        .finally(() => {
          this._mediaBrowserProbePending.delete(key);
        });
      this._mediaBrowserProbePending.set(key, { promise, contexts, target });
    }
  }
  _handleMediaBrowserProbeCompletion(itemKey, contexts) {
    if (!itemKey) {
      return;
    }
    if (contexts instanceof Set && contexts.has(this._mediaBrowserCurrentContextKey)) {
      this._refreshMediaBrowserDisplay(this._mediaBrowserCurrentContextKey);
    } else {
      this.requestUpdate();
    }
  }
  _refreshMediaBrowserDisplay(contextKey = this._mediaBrowserCurrentContextKey) {
    if (!contextKey || contextKey !== this._mediaBrowserCurrentContextKey) {
      return;
    }
    const children = Array.isArray(this._mediaBrowserLastChildren) ? this._mediaBrowserLastChildren : [];
    this._mediaBrowserItems = this._filterMediaItems(children, contextKey);
  }
  _mediaBrowserProbeKey(item) {
    if (!item) {
      return "";
    }
    const rawId = item.media_content_id ?? item.id;
    const canonicalId = this._normalizeMediaBrowserId(rawId);
    if (!canonicalId) {
      return "";
    }
    const rawType =
      typeof item.media_content_type === "string" && item.media_content_type
        ? item.media_content_type
        : typeof item.type === "string"
            ? item.type
            : "";
    return this._mediaBrowserSelectionKey(canonicalId, rawType);
  }
  async _probeMediaBrowserDescriptor(descriptor, target, depth = 0, visited = new Set()) {
    const normalized = this._normalizeMediaDescriptor(descriptor);
    if (!normalized.id) {
      return { hasAudio: false, empty: true };
    }
    const entityId = target || this._mediaBrowserTarget;
    if (!this.hass || !entityId) {
      throw new Error("Media browser unavailable");
    }
    const response = await this._callMediaBrowser(normalized, entityId);
    const children = Array.isArray(response?.children) ? response.children : [];
    let sawChild = false;
    let processed = 0;
    for (const child of children) {
      if (!child) {
        continue;
      }
      sawChild = true;
      if (this._mediaItemIsBlocked(child)) {
        continue;
      }
      if (child.can_play && this._mediaItemLooksAudio(child)) {
        return { hasAudio: true, empty: false };
      }
      if (child.can_expand) {
        if (this._mediaItemLooksAudioContainer(child)) {
          return { hasAudio: true, empty: false };
        }
        if (this._mediaItemLooksEmpty(child)) {
          continue;
        }
        if (depth + 1 < MEDIA_PROBE_MAX_DEPTH) {
          const probeKey = this._mediaBrowserProbeKey(child);
          if (probeKey && visited.has(probeKey)) {
            continue;
          }
          const nextDescriptor = {
            id: child.media_content_id,
            type: child.media_content_type,
          };
          if (probeKey) {
            visited.add(probeKey);
          }
          const result = await this._probeMediaBrowserDescriptor(nextDescriptor, entityId, depth + 1, visited);
          if (probeKey) {
            visited.delete(probeKey);
          }
          if (result.hasAudio) {
            return { hasAudio: true, empty: false };
          }
        }
      }
      processed += 1;
      if (processed >= MEDIA_PROBE_MAX_BRANCHES) {
        break;
      }
    }
    return { hasAudio: false, empty: !sawChild };
  }
  _buildMediaBrowserContextKey(descriptor) {
    const target = this._mediaBrowserTarget || "";
    const canonicalId = this._normalizeMediaBrowserId(descriptor?.id || "");
    const normalizedType =
      typeof descriptor?.type === "string" && descriptor.type ? descriptor.type.trim().toLowerCase() : "";
    const scopeId = canonicalId || "root";
    return `${target}|${scopeId}|${normalizedType}`;
  }
  _selectMediaItem(item) {
    if (!item?.media_content_id) {
      return;
    }
    const descriptor = {
      media_content_id: item.media_content_id,
      media_content_type: item.media_content_type || item.media_class || "",
    };
    if (item.title) {
      descriptor.media_content_title = item.title;
    }
    if (item.thumbnail) {
      descriptor.thumbnail = item.thumbnail;
    }
    if (item.media_content_provider) {
      descriptor.media_content_provider = item.media_content_provider;
    }
    if (!descriptor.media_content_provider) {
      const parsed = this._parseSpotifyIdentifier(item.media_content_id);
      if (parsed) {
        descriptor.media_content_provider = "spotify";
      }
    }
    if (item.metadata && typeof item.metadata === "object") {
      descriptor.metadata = { ...item.metadata };
    }
    this._debugSpotify("Media item selected", {
      descriptor: this._summarizeSpotifyDescriptor(descriptor),
      item: this._summarizeMediaItem(item),
    });
    const recordedPath = this._recordMediaBrowserPathForSelection(
      item.media_content_id,
      item.media_content_type || item.media_class || ""
    );
    if (recordedPath?.length) {
      descriptor.media_browser_path = recordedPath.map((entry) => ({ ...entry }));
    } else {
      delete descriptor.media_browser_path;
    }
    this._updateFormField("sound_media_id", item.media_content_id);
    this._updateFormField("sound_media_type", item.media_content_type || item.media_class || "");
    this._updateFormField("_sound_media_descriptor", descriptor);
    const displayTitle = this._buildSelectedMediaTitle(descriptor, item);
    this._updateFormField("sound_media_title", displayTitle || "");
    const label = item.title || formatMediaName(item.media_content_id);
    this._notify(label ? `Media set to ${label}` : "Media selection updated");
    this._closeMediaBrowser();
    this._maybeResolveSpotifyPlusMetadata(descriptor, item);
    this._maybeResolvePlexMetadata(descriptor, item);
    this._maybeResolveJellyfinMetadata(descriptor, item);
    this._maybeResolveDlnaMetadata(descriptor, item);
  }
  _buildSelectedMediaTitle(descriptor, item) {
    const fallback =
      descriptor?.media_content_title ||
      descriptor?.title ||
      item?.title ||
      formatMediaName(item?.media_content_id);
    const providerValue = descriptor?.media_content_provider || item?.media_content_provider || "";
    const provider = typeof providerValue === "string" ? providerValue.toLowerCase() : "";
    const idSource = descriptor?.media_content_id || item?.media_content_id || "";
    const parsed = this._parseSpotifyIdentifier(idSource);
    const isSpotify = provider.includes("spotify") || !!parsed;
    const typeCandidate = descriptor?.media_content_type || item?.media_content_type || parsed?.type || "";
    const type = this._normalizeMediaClass(typeCandidate);
    if (!isSpotify || (type !== "track" && type !== "album")) {
      this._debugSpotify("Title fallback: not spotify track/album", {
        providerValue,
        provider,
        parsedType: parsed?.type,
        normalizedType: type,
        descriptor: this._summarizeSpotifyDescriptor(descriptor),
        item: this._summarizeMediaItem(item),
      });
      return fallback;
    }
    const metadataSources = [descriptor?.metadata, item?.metadata].filter(Boolean);
    let artist = "";
    for (const source of metadataSources) {
      if (!source) {
        continue;
      }
      if (Array.isArray(source.artists) && source.artists.length) {
        artist = source.artists[0];
      } else {
        artist = source.artist || source.artist_name || source.artistLabel;
      }
      if (artist) {
        break;
      }
    }
    if (!artist) {
      artist = item?.artist || item?.artist_name || "";
    }
    if (!artist) {
      const subtitle = item?.subtitle || "";
      if (subtitle.includes(" \u00b7 ")) {
        artist = subtitle.split(" \u00b7 ")[0];
      }
    }
    if (!artist || !fallback) {
      this._debugSpotify("Title fallback: missing artist or title", {
        artist,
        fallback,
        descriptor: this._summarizeSpotifyDescriptor(descriptor),
        item: this._summarizeMediaItem(item),
      });
      return fallback;
    }
    const normalizedArtist = artist.trim();
    const normalizedTitle = fallback.trim();
    if (!normalizedArtist || !normalizedTitle) {
      return fallback;
    }
    if (normalizedTitle.toLowerCase().includes(normalizedArtist.toLowerCase())) {
      this._debugSpotify("Title already contained artist", {
        artist: normalizedArtist,
        title: normalizedTitle,
      });
      return normalizedTitle;
    }
    const combined = `${normalizedArtist} - ${normalizedTitle}`;
    this._debugSpotify("Title combined with artist", {
      artist: normalizedArtist,
      title: normalizedTitle,
      combined,
    });
    return combined;
  }
  _openDialog(mode, alarm, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this._dialogMode = mode;
    this._dialogError = "";
    this._saving = false;
    if (mode === "edit" && alarm) {
      this._formData = this._prefillFromAlarm(alarm);
    } else {
      this._formData = this._blankForm();
    }
    this._resetPreviewState();
    this._refreshMediaPreviewState();
    this._enforceSpotifyDialogState();
    this._handleSoundMediaDescriptorChanged();
    this._dialogOpen = true;
  }
  _closeDialog() {
    this._stopMediaPreview();
    this._resetPreviewState();
    this._dialogOpen = false;
    this._dialogMode = "create";
    this._formData = this._blankForm();
    this._dialogError = "";
    this._saving = false;
    this._ttsMemory = null;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopMediaPreview();
  }
  _blankForm() {
    const settings = this._getIntegrationSettings();
    const defaultSound = settings.default_alarm_sound || "";
    return {
      alarm_id: null,
      name: "",
      message: "",
      time: "07:00",
      date: "",
      repeat: "once",
      repeat_days: [],
      media_player: "",
      sound_media_id: defaultSound,
      sound_media_type: "",
      sound_media_title: "",
      spotify_source: "",
      _sound_media_descriptor: null,
      _original_sound_media_id: defaultSound,
      _original_sound_media_type: "",
      _original_sound_media_title: "",
      _original_sound_media_descriptor: null,
      _original_spotify_source: "",
      activation_entity: "",
      announce_time: true,
      announce_name: true,
    };
  }
  _prefillFromAlarm(alarm) {
    const stateObj = this.hass?.states?.[alarm.entity_id];
    const attrs = stateObj?.attributes || {};
    const scheduledSource = attrs.scheduled_time || alarm.scheduledTime;
    const scheduled = scheduledSource ? new Date(scheduledSource) : new Date();
    const mediaPlayer = this._normalizeMediaPlayerValue(
      attrs.media_player ||
        attrs.media_player_id ||
        attrs.media_player_entity_id ||
        attrs.media_player_target ||
        alarm.media_player ||
        alarm.media_player_id ||
        alarm.media_player_entity_id ||
        alarm.mediaPlayer
    );
    const repeatSource = attrs.repeat !== undefined ? attrs.repeat : alarm.repeat;
    const repeat = this._normalizeRepeatValue(repeatSource);
    const repeatDaysSource = attrs.repeat_days !== undefined ? attrs.repeat_days : alarm.repeat_days;
    const repeatDays = this._normalizeRepeatDaysList(repeatDaysSource);
    const soundDescriptor =
      typeof attrs.sound_media === "object" && attrs.sound_media
        ? { ...attrs.sound_media }
        : undefined;
    const soundMediaId =
      (soundDescriptor && soundDescriptor.media_content_id) || attrs.sound_media || alarm.sound_media_id || "";
    const soundMediaType =
      (soundDescriptor && soundDescriptor.media_content_type) || alarm.sound_media_type || "";
    const soundMediaDescriptor = soundDescriptor ? { ...soundDescriptor } : null;
    if (soundMediaDescriptor) {
      const normalizedPath = this._sanitizeMediaBrowserPath(soundMediaDescriptor.media_browser_path);
      if (normalizedPath.length) {
        soundMediaDescriptor.media_browser_path = normalizedPath.map((entry) => ({ ...entry }));
      } else {
        delete soundMediaDescriptor.media_browser_path;
      }
    }
    const descriptorTitle =
      typeof soundDescriptor === "object"
        ? soundDescriptor.media_content_title || soundDescriptor.title || ""
        : "";
    const soundMediaTitle = descriptorTitle || mediaLabelFromDescriptor(soundDescriptor, soundMediaId) || "";
    const rawNameSource = typeof (attrs.name ?? alarm.name) === "string" ? (attrs.name ?? alarm.name) : "";
    const nameForInput = this._isDefaultAlarmName(rawNameSource)
      ? ""
      : this._formatNameForInput(rawNameSource);
    return {
      alarm_id: alarm.entity_id,
      name: nameForInput,
      message: attrs.message ?? alarm.message ?? "",
      time: `${scheduled.getHours().toString().padStart(2, "0")}:${scheduled
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      date: scheduled.toISOString().slice(0, 10),
      repeat,
      repeat_days: repeat === "custom" ? repeatDays : [],
      media_player: mediaPlayer,
      sound_media_id: soundMediaId,
      sound_media_type: soundMediaType,
      sound_media_title: soundMediaTitle,
      spotify_source: attrs.spotify_source ?? alarm.spotify_source ?? "",
      _sound_media_descriptor: soundMediaDescriptor,
      _original_sound_media_id: soundMediaId,
      _original_sound_media_type: soundMediaType,
      _original_sound_media_title: soundMediaTitle,
      _original_sound_media_descriptor: soundDescriptor ? { ...soundDescriptor } : null,
      _original_spotify_source: attrs.spotify_source ?? alarm.spotify_source ?? "",
      activation_entity: attrs.activation_entity ?? alarm.activation_entity ?? "",
      announce_time: attrs.announce_time ?? alarm.announce_time ?? true,
      announce_name: attrs.announce_name ?? alarm.announce_name ?? true,
    };
  }
  _updateFormField(field, value) {
    const prevForm = this._formData;
    let processedValue = value;
    if (field === "media_player") {
      processedValue = this._normalizeMediaPlayerValue(value);
    } else if (field === "repeat") {
      processedValue = this._normalizeRepeatValue(value);
      if (processedValue !== "custom") {
        // Clear custom day selection when switching away to avoid stale data.
        this._formData = {
          ...this._formData,
          repeat_days: [],
        };
      }
    } else if (field === "repeat_days") {
      processedValue = this._normalizeRepeatDaysList(value);
    } else if (field === "sound_media_id") {
      processedValue = typeof value === "string" ? value : "";
    } else if (field === "sound_media_type") {
      processedValue = typeof value === "string" ? value.trim() : "";
    } else if (field === "sound_media_title") {
      processedValue = typeof value === "string" ? value.trim() : "";
    } else if (field === "_sound_media_descriptor") {
      processedValue = value && typeof value === "object" ? { ...value } : null;
    } else if (field === "spotify_source") {
      processedValue = this._normalizeSpotifySourceValue(value);
    }
    const updates = {
      [field]: processedValue,
    };
    if (field === "sound_media_id" || field === "sound_media_type") {
      const descriptor = this._formData._sound_media_descriptor;
      if (descriptor) {
        const descriptorId = this._normalizeMediaPlayerValue(descriptor.media_content_id || descriptor.id || "");
        const descriptorType = descriptor.media_content_type || descriptor.type || "";
        const idMismatch = field === "sound_media_id" && processedValue !== descriptorId;
        if (idMismatch) {
          updates._sound_media_descriptor = null;
          updates.sound_media_title = "";
        } else if (field === "sound_media_type" && descriptorType !== processedValue) {
          updates._sound_media_descriptor = {
            ...descriptor,
            media_content_type: processedValue,
            type: processedValue || descriptor.type,
          };
        }
      }
    }
    if (field === "sound_media_title") {
      const descriptor = this._formData._sound_media_descriptor;
      if (descriptor) {
        const nextDescriptor = {
          ...descriptor,
        };
        if (processedValue) {
          nextDescriptor.media_content_title = processedValue;
          nextDescriptor.title = processedValue;
          if (nextDescriptor.metadata && typeof nextDescriptor.metadata === "object") {
            nextDescriptor.metadata = {
              ...nextDescriptor.metadata,
              title: processedValue,
              name: processedValue,
            };
          }
        } else {
          delete nextDescriptor.media_content_title;
          if (descriptor.title) {
            nextDescriptor.title = descriptor.title;
          } else {
            delete nextDescriptor.title;
          }
        }
        updates._sound_media_descriptor = nextDescriptor;
      }
    }
    this._formData = {
      ...this._formData,
      ...updates,
    };
    this._handlePostFormUpdate(field, processedValue, prevForm);
    if (
      field === "sound_media_id" ||
      field === "sound_media_type" ||
      field === "_sound_media_descriptor" ||
      field === "sound_media_title"
    ) {
      this._refreshMediaPreviewState();
    }
  }
  _handlePostFormUpdate(field, value, prevForm) {
    if (field === "media_player") {
      this._handleMediaPlayerChange(value, prevForm?.media_player, prevForm);
    } else if (
      !this._suppressSpotifyMetadataUpdate &&
      !this._suppressPlexMetadataUpdate &&
      !this._suppressDlnaMetadataUpdate &&
      (field === "sound_media_id" || field === "sound_media_type" || field === "_sound_media_descriptor")
    ) {
      this._handleSoundMediaDescriptorChanged();
    }
  }
  _handleSoundMediaDescriptorChanged() {
    const descriptor = this._formData._sound_media_descriptor;
    if (!descriptor) {
      if (this._maybeSeedDescriptorFromManualId()) {
        return;
      }
    }
    if (descriptor) {
      this._maybeResolveSpotifyPlusMetadata(descriptor);
      this._maybeResolvePlexMetadata(descriptor);
      this._maybeResolveJellyfinMetadata(descriptor);
      this._maybeResolveDlnaMetadata(descriptor);
    }
  }
  _maybeSeedDescriptorFromManualId() {
    const mediaId = this._normalizeMediaPlayerValue(this._formData.sound_media_id);
    const player = this._normalizeMediaPlayerValue(this._formData.media_player);
    if (!mediaId || !player || !this._isSpotifyPlayer(player)) {
      return false;
    }
    const parsed = this._parseSpotifyIdentifier(mediaId);
    if (!parsed) {
      return false;
    }
    const descriptor = {
      media_content_id: parsed.uri,
      media_content_type: parsed.type,
      media_content_provider: "spotify",
    };
    this._updateFormField("_sound_media_descriptor", descriptor);
    if (!this._formData.sound_media_type && parsed.type) {
      this._updateFormField("sound_media_type", parsed.type);
    }
    return true;
  }
  _maybeResolveSpotifyPlusMetadata(descriptor, item = null) {
    if (!descriptor || !this.hass) {
      this._debugSpotify("Skip metadata resolution: missing descriptor or hass", {
        hasDescriptor: !!descriptor,
        hasHass: !!this.hass,
      });
      return;
    }
    const player = this._normalizeMediaPlayerValue(this._formData.media_player || this._mediaBrowserTarget);
    if (!player || !this._isSpotifyPlayer(player)) {
      this._debugSpotify("Skip metadata resolution: invalid player", {
        player,
        isSpotify: this._isSpotifyPlayer(player),
      });
      return;
    }
    const metadataPlayer = this._resolveSpotifyMetadataPlayer(player);
    if (!metadataPlayer) {
      this._debugSpotify("Skip metadata resolution: missing SpotifyPlus metadata player", {
        player,
        availableSpotifyPlusPlayers: this._getSpotifyPlusPlayers(),
      });
      return;
    }
    const lookup = this._determineSpotifyPlusLookupTarget(descriptor, item);
    if (!lookup) {
      this._debugSpotify("Skip metadata resolution: unable to determine lookup target", {
        descriptor: this._summarizeSpotifyDescriptor(descriptor),
        item: this._summarizeMediaItem(item),
      });
      return;
    }
    this._debugSpotify("Attempting Spotify metadata resolution", {
      player,
      metadataPlayer,
      lookup,
      descriptor: this._summarizeSpotifyDescriptor(descriptor),
    });
    const cacheKey = `${lookup.type}|${lookup.id}`;
    if (this._spotifyMetadataCache.has(cacheKey)) {
      const cached = this._spotifyMetadataCache.get(cacheKey);
      if (cached) {
        this._debugSpotify("Using cached Spotify metadata", {
          cacheKey,
          lookup,
        });
        this._applySpotifyPlusMetadata(descriptor, item, cached, lookup.type);
      }
      return;
    }
    if (this._spotifyMetadataPending.has(cacheKey)) {
      this._debugSpotify("Metadata lookup already pending", { cacheKey, lookup });
      return;
    }
    this._spotifyMetadataPending.set(cacheKey, true);
  this._debugSpotify("Calling SpotifyPlus service", { cacheKey, lookup, metadataPlayer });
  this._callSpotifyPlusService(metadataPlayer, lookup.service, { [lookup.idField]: lookup.id })
      .then((result) => {
        if (!result) {
          this._debugSpotify("SpotifyPlus service returned no result", { cacheKey, lookup });
          return;
        }
        this._debugSpotify("SpotifyPlus service result received", {
          cacheKey,
          lookup,
          result: this._summarizeSpotifyResult(result),
        });
        this._spotifyMetadataCache.set(cacheKey, result);
        this._applySpotifyPlusMetadata(descriptor, item, result, lookup.type);
      })
      .catch((err) => {
        console.warn("SpotifyPlus metadata lookup failed", err);
        this._debugSpotify("SpotifyPlus service call failed", {
          cacheKey,
          lookup,
          error: err?.message || String(err),
        });
      })
      .finally(() => {
        this._spotifyMetadataPending.delete(cacheKey);
      });
  }
    _descriptorLooksLikePlex(descriptor, item = null) {
      if (!descriptor && !item) {
        this._debugPlex("Descriptor check skipped: nothing provided");
        return false;
      }
      const providerValue =
        descriptor?.media_content_provider || descriptor?.provider || item?.media_content_provider || "";
      const provider = typeof providerValue === "string" ? providerValue.toLowerCase() : "";
      const mediaId = descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id;
      const lowerId = typeof mediaId === "string" ? mediaId.toLowerCase() : "";
      const looksLike = Boolean(
        (provider && provider.includes("plex")) ||
          lowerId.startsWith("media-source://plex/") ||
          lowerId.startsWith("plex://")
      );
      this._debugPlex("Descriptor Plex detection result", {
        descriptor: this._summarizePlexDescriptor(descriptor, item),
        looksLike,
      });
      return looksLike;
    }
    _maybeResolvePlexMetadata(descriptor, item = null) {
      if (!descriptor || !this.hass) {
        this._debugPlex("Skip Plex metadata: missing descriptor or hass", {
          hasDescriptor: !!descriptor,
          hasHass: !!this.hass,
        });
        return;
      }
      if (this._suppressPlexMetadataUpdate) {
        this._debugPlex("Skip Plex metadata: currently applying metadata", {
          descriptor: this._summarizePlexDescriptor(descriptor, item),
        });
        return;
      }
      if (!this._descriptorLooksLikePlex(descriptor, item)) {
        this._debugPlex("Skip Plex metadata: descriptor not recognized as Plex", {
          descriptor: this._summarizePlexDescriptor(descriptor, item),
        });
        return;
      }
      const mediaId = descriptor.media_content_id || descriptor.id || item?.media_content_id || item?.id;
      if (typeof mediaId !== "string" || !mediaId) {
        this._debugPlex("Skip Plex metadata: invalid media identifier", {
          descriptor: this._summarizePlexDescriptor(descriptor, item),
          mediaId,
        });
        return;
      }
      const cacheKey = mediaId;
      const mediaType = descriptor.media_content_type || descriptor.type || item?.media_content_type || item?.type;
      this._debugPlex("Processing Plex metadata request", {
        cacheKey,
        mediaType,
        descriptor: this._summarizePlexDescriptor(descriptor, item),
      });
      if (this._plexMetadataCache.has(cacheKey)) {
        const cached = this._plexMetadataCache.get(cacheKey);
        if (cached) {
          this._debugPlex("Using cached Plex metadata", {
            cacheKey,
            metadata: this._summarizePlexMetadata(cached),
          });
          this._applyPlexMetadata(descriptor, cached, item);
        } else {
          this._debugPlex("Cached Plex metadata entry was empty", { cacheKey });
        }
        return;
      }
      if (this._plexMetadataPending.has(cacheKey)) {
        this._debugPlex("Plex metadata lookup already pending", { cacheKey });
        return;
      }
      const payload = {
        media_content_id: mediaId,
      };
      if (mediaType) {
        payload.media_content_type = mediaType;
      }
      this._plexMetadataPending.add(cacheKey);
      this._debugPlex("Calling backend Plex resolver", {
        cacheKey,
        payload: { ...payload, type: RESOLVE_MEDIA_TYPE },
      });
      this._callResolveMedia(payload)
        .then((result) => {
          if (result) {
            this._debugPlex("Plex metadata response received", {
              cacheKey,
              metadata: this._summarizePlexMetadata(result),
            });
            this._plexMetadataCache.set(cacheKey, result);
            this._applyPlexMetadata(descriptor, result, item);
          } else {
            this._debugPlex("Plex metadata response was empty", { cacheKey });
          }
        })
        .catch((err) => {
          console.warn("Plex metadata lookup failed", err);
          this._debugPlex("Plex metadata lookup failed", {
            cacheKey,
            error: err?.message || String(err),
          });
        })
        .finally(() => {
          this._plexMetadataPending.delete(cacheKey);
          this._debugPlex("Cleared Plex metadata pending flag", { cacheKey });
        });
    }
    _applyPlexMetadata(descriptor, metadata, item = null) {
      if (!metadata || !this._formData || !this._formData._sound_media_descriptor) {
        this._debugPlex("Skip Plex metadata apply: form not ready", {
          hasMetadata: !!metadata,
          hasForm: !!this._formData,
          hasDescriptor: !!this._formData?._sound_media_descriptor,
        });
        return;
      }
      const currentDescriptor = this._formData._sound_media_descriptor;
      const normalizeId = (value) => (typeof value === "string" ? value.trim() : "");
      const currentId = normalizeId(currentDescriptor.media_content_id || currentDescriptor.id);
      const targetId = normalizeId(
        descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id
      );
      if (currentId && targetId && currentId !== targetId) {
        this._debugPlex("Skip Plex metadata apply: descriptor changed", {
          currentId,
          targetId,
        });
        return;
      }

      const merged = {
        ...currentDescriptor,
        media_content_provider: currentDescriptor.media_content_provider || "plex",
      };
      const meta = {
        ...(currentDescriptor.metadata || {}),
      };

      this._debugPlex("Applying Plex metadata", {
        descriptor: this._summarizePlexDescriptor(currentDescriptor, item),
        metadata: this._summarizePlexMetadata(metadata),
      });

      if (metadata.media_content_type && !merged.media_content_type) {
        merged.media_content_type = metadata.media_content_type;
      }
      if (metadata.title && !merged.title) {
        merged.title = metadata.title;
      }
      if (metadata.display_title) {
        merged.media_content_title = metadata.display_title;
      } else if (metadata.title && !merged.media_content_title) {
        merged.media_content_title = metadata.title;
      }
      if (metadata.thumb && !merged.thumbnail) {
        merged.thumbnail = metadata.thumb;
      }
      if (metadata.artist) {
        meta.artist = meta.artist || metadata.artist;
        meta.artist_name = meta.artist_name || metadata.artist;
        if (!Array.isArray(meta.artists) || !meta.artists.length) {
          meta.artists = [metadata.artist];
        }
      }
      if (metadata.album) {
        meta.album = meta.album || metadata.album;
        meta.album_name = meta.album_name || metadata.album;
      }
      if (metadata.duration && !meta.duration) {
        meta.duration = metadata.duration;
      }
      merged.metadata = meta;

      this._suppressPlexMetadataUpdate = true;
      try {
        this._updateFormField("_sound_media_descriptor", merged);
        const resolvedTitle = merged.media_content_title || metadata.display_title || metadata.title;
        if (resolvedTitle && resolvedTitle !== this._formData.sound_media_title) {
          this._updateFormField("sound_media_title", resolvedTitle);
        }
        this._debugPlex("Updated form with Plex metadata", {
          descriptor: this._summarizePlexDescriptor(merged, item),
          resolvedTitle,
        });
      } finally {
        this._suppressPlexMetadataUpdate = false;
      }
    }
    _descriptorLooksLikeJellyfin(descriptor, item = null) {
      if (!descriptor && !item) {
        this._debugJellyfin("Descriptor check skipped: nothing provided");
        return false;
      }
      const providerValue =
        descriptor?.media_content_provider || descriptor?.provider || item?.media_content_provider || "";
      const provider = typeof providerValue === "string" ? providerValue.toLowerCase() : "";
      const mediaId = descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id;
      const lowerId = typeof mediaId === "string" ? mediaId.toLowerCase() : "";
      const looksLike = Boolean(provider.includes("jellyfin") || lowerId.startsWith("media-source://jellyfin/"));
      this._debugJellyfin("Descriptor Jellyfin detection result", {
        descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
        looksLike,
      });
      return looksLike;
    }
    _maybeResolveJellyfinMetadata(descriptor, item = null) {
      if (!descriptor || !this.hass) {
        this._debugJellyfin("Skip Jellyfin metadata: missing descriptor or hass", {
          hasDescriptor: !!descriptor,
          hasHass: !!this.hass,
        });
        return;
      }
      if (this._suppressJellyfinMetadataUpdate) {
        this._debugJellyfin("Skip Jellyfin metadata: currently applying metadata", {
          descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
        });
        return;
      }
      if (!this._descriptorLooksLikeJellyfin(descriptor, item)) {
        this._debugJellyfin("Skip Jellyfin metadata: descriptor not recognized as Jellyfin", {
          descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
        });
        return;
      }
      const mediaId = descriptor.media_content_id || descriptor.id || item?.media_content_id || item?.id;
  const providerValue = descriptor.media_content_provider || descriptor.provider || item?.media_content_provider || "";
  const provider = typeof providerValue === "string" ? providerValue.toLowerCase() : "";
      if (typeof mediaId !== "string" || !mediaId) {
        this._debugJellyfin("Skip Jellyfin metadata: invalid media identifier", {
          descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
          mediaId,
        });
        return;
      }
      if (provider && provider !== "jellyfin") {
        this._debugJellyfin("Skip Jellyfin metadata: descriptor provider mismatch", {
          descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
          provider,
        });
        return;
      }
      const cacheKey = mediaId;
      const mediaType = descriptor.media_content_type || descriptor.type || item?.media_content_type || item?.type;
      const resolvedMediaType = typeof mediaType === "string" && mediaType.trim() ? mediaType : "audio";
      this._debugJellyfin("Processing Jellyfin metadata request", {
        cacheKey,
        mediaType: resolvedMediaType,
        descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
      });
      if (this._jellyfinMetadataCache.has(cacheKey)) {
        const cached = this._jellyfinMetadataCache.get(cacheKey);
        if (cached) {
          this._debugJellyfin("Using cached Jellyfin metadata", {
            cacheKey,
            metadata: this._summarizeJellyfinMetadata(cached),
          });
          this._applyJellyfinMetadata(descriptor, cached, item);
        } else {
          this._debugJellyfin("Cached Jellyfin metadata entry was empty", { cacheKey });
        }
        return;
      }
      if (this._jellyfinMetadataPending.has(cacheKey)) {
        this._debugJellyfin("Jellyfin metadata lookup already pending", { cacheKey });
        return;
      }
      const payload = {
        media_content_id: mediaId,
        media_content_type: resolvedMediaType,
        provider: "jellyfin",
      };
      this._jellyfinMetadataPending.add(cacheKey);
      this._debugJellyfin("Calling backend Jellyfin resolver", {
        cacheKey,
        payload: { ...payload, type: RESOLVE_MEDIA_TYPE },
      });
      this._callResolveMedia(payload)
        .then((result) => {
          if (result) {
            this._debugJellyfin("Jellyfin metadata response received", {
              cacheKey,
              metadata: this._summarizeJellyfinMetadata(result),
            });
            this._jellyfinMetadataCache.set(cacheKey, result);
            this._applyJellyfinMetadata(descriptor, result, item);
          } else {
            this._debugJellyfin("Jellyfin metadata response was empty", { cacheKey });
          }
        })
        .catch((err) => {
          console.warn("Jellyfin metadata lookup failed", err);
          this._debugJellyfin("Jellyfin metadata lookup failed", {
            cacheKey,
            descriptor: this._summarizeJellyfinDescriptor(descriptor, item),
            payload,
            error: err?.message || String(err),
          });
        })
        .finally(() => {
          this._jellyfinMetadataPending.delete(cacheKey);
          this._debugJellyfin("Cleared Jellyfin metadata pending flag", { cacheKey });
        });
    }
    _applyJellyfinMetadata(descriptor, metadata, item = null) {
      if (!metadata || !this._formData || !this._formData._sound_media_descriptor) {
        this._debugJellyfin("Skip Jellyfin metadata apply: form not ready", {
          hasMetadata: !!metadata,
          hasForm: !!this._formData,
          hasDescriptor: !!this._formData?._sound_media_descriptor,
        });
        return;
      }
      const currentDescriptor = this._formData._sound_media_descriptor;
      const normalizeId = (value) => (typeof value === "string" ? value.trim() : "");
      const currentId = normalizeId(currentDescriptor.media_content_id || currentDescriptor.id);
      const targetId = normalizeId(
        descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id
      );
      if (currentId && targetId && currentId !== targetId) {
        this._debugJellyfin("Skip Jellyfin metadata apply: descriptor changed", {
          currentId,
          targetId,
        });
        return;
      }

      const merged = {
        ...currentDescriptor,
        media_content_provider: currentDescriptor.media_content_provider || metadata.provider || "jellyfin",
      };
      const meta = {
        ...(currentDescriptor.metadata || {}),
      };

      this._debugJellyfin("Applying Jellyfin metadata", {
        descriptor: this._summarizeJellyfinDescriptor(merged, item),
        metadata: this._summarizeJellyfinMetadata(metadata),
      });

      if (metadata.media_content_type) {
        merged.media_content_type = metadata.media_content_type;
        merged.type = metadata.media_content_type;
      }
      if (metadata.title && !merged.title) {
        merged.title = metadata.title;
      }
      if (metadata.display_title) {
        merged.media_content_title = metadata.display_title;
      } else if (metadata.title && !merged.media_content_title) {
        merged.media_content_title = metadata.title;
      }
      if (metadata.thumb && !merged.thumbnail) {
        merged.thumbnail = metadata.thumb;
      }
      if (metadata.artist) {
        meta.artist = meta.artist || metadata.artist;
        meta.artist_name = meta.artist_name || metadata.artist;
        if (!Array.isArray(meta.artists) || !meta.artists.length) {
          meta.artists = [metadata.artist];
        }
      }
      if (metadata.album) {
        meta.album = meta.album || metadata.album;
        meta.album_name = meta.album_name || metadata.album;
      }
      if (metadata.duration && !meta.duration) {
        meta.duration = metadata.duration;
      }
      merged.metadata = meta;

      this._suppressJellyfinMetadataUpdate = true;
      try {
        this._updateFormField("_sound_media_descriptor", merged);
        const resolvedTitle = merged.media_content_title || metadata.display_title || metadata.title;
        if (resolvedTitle && resolvedTitle !== this._formData.sound_media_title) {
          this._updateFormField("sound_media_title", resolvedTitle);
        }
        this._debugJellyfin("Updated form with Jellyfin metadata", {
          descriptor: this._summarizeJellyfinDescriptor(merged, item),
          resolvedTitle,
        });
      } finally {
        this._suppressJellyfinMetadataUpdate = false;
      }
    }
    _descriptorLooksLikeDlna(descriptor, item = null) {
      if (!descriptor && !item) {
        this._debugDlna("Descriptor check skipped: nothing provided");
        return false;
      }
      const providerValue =
        descriptor?.media_content_provider ||
        descriptor?.provider ||
        item?.media_content_provider ||
        item?.provider ||
        "";
      const provider = typeof providerValue === "string" ? providerValue.toLowerCase() : "";
      const mediaId = descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id;
      const lowerId = typeof mediaId === "string" ? mediaId.toLowerCase() : "";
      const looksLike = Boolean(
        provider.includes("dlna") || lowerId.startsWith("media-source://dlna_dms/") || lowerId.startsWith("dlna://")
      );
      this._debugDlna("Descriptor DLNA detection result", {
        descriptor: this._summarizeDlnaDescriptor(descriptor, item),
        looksLike,
      });
      return looksLike;
    }
    _maybeResolveDlnaMetadata(descriptor, item = null) {
      if (!descriptor || !this.hass) {
        this._debugDlna("Skip DLNA metadata: missing descriptor or hass", {
          hasDescriptor: !!descriptor,
          hasHass: !!this.hass,
        });
        return;
      }
      if (this._suppressDlnaMetadataUpdate) {
        this._debugDlna("Skip DLNA metadata: currently applying metadata", {
          descriptor: this._summarizeDlnaDescriptor(descriptor, item),
        });
        return;
      }
      if (!this._descriptorLooksLikeDlna(descriptor, item)) {
        this._debugDlna("Skip DLNA metadata: descriptor not recognized as DLNA", {
          descriptor: this._summarizeDlnaDescriptor(descriptor, item),
        });
        return;
      }
      const mediaId = descriptor.media_content_id || descriptor.id || item?.media_content_id || item?.id;
      if (typeof mediaId !== "string" || !mediaId) {
        this._debugDlna("Skip DLNA metadata: invalid media identifier", {
          descriptor: this._summarizeDlnaDescriptor(descriptor, item),
          mediaId,
        });
        return;
      }
      const cacheKey = mediaId;
      const mediaType = descriptor.media_content_type || descriptor.type || item?.media_content_type || item?.type;
      this._debugDlna("Processing DLNA metadata request", {
        cacheKey,
        mediaType,
        descriptor: this._summarizeDlnaDescriptor(descriptor, item),
      });
      if (this._dlnaMetadataCache.has(cacheKey)) {
        const cached = this._dlnaMetadataCache.get(cacheKey);
        if (cached) {
          this._debugDlna("Using cached DLNA metadata", {
            cacheKey,
            metadata: this._summarizeDlnaMetadata(cached),
          });
          this._applyDlnaMetadata(descriptor, cached, item);
        } else {
          this._debugDlna("Cached DLNA metadata entry was empty", { cacheKey });
        }
        return;
      }
      if (this._dlnaMetadataPending.has(cacheKey)) {
        this._debugDlna("DLNA metadata lookup already pending", { cacheKey });
        return;
      }
      const payload = {
        media_content_id: mediaId,
        provider: "dlna_dms",
      };
      if (mediaType) {
        payload.media_content_type = mediaType;
      }
      this._dlnaMetadataPending.add(cacheKey);
      this._debugDlna("Calling backend DLNA resolver", {
        cacheKey,
        payload: { ...payload, type: RESOLVE_MEDIA_TYPE },
      });
      this._callResolveMedia(payload)
        .then((result) => {
          if (result) {
            this._debugDlna("DLNA metadata response received", {
              cacheKey,
              metadata: this._summarizeDlnaMetadata(result),
            });
            this._dlnaMetadataCache.set(cacheKey, result);
            this._applyDlnaMetadata(descriptor, result, item);
          } else {
            this._debugDlna("DLNA metadata response was empty", { cacheKey });
          }
        })
        .catch((err) => {
          console.warn("DLNA metadata lookup failed", err);
          this._debugDlna("DLNA metadata lookup failed", {
            cacheKey,
            error: err?.message || String(err),
          });
        })
        .finally(() => {
          this._dlnaMetadataPending.delete(cacheKey);
          this._debugDlna("Cleared DLNA metadata pending flag", { cacheKey });
        });
    }
    _applyDlnaMetadata(descriptor, metadata, item = null) {
      if (!metadata || !this._formData || !this._formData._sound_media_descriptor) {
        this._debugDlna("Skip DLNA metadata apply: form not ready", {
          hasMetadata: !!metadata,
          hasForm: !!this._formData,
          hasDescriptor: !!this._formData?._sound_media_descriptor,
        });
        return;
      }
      const currentDescriptor = this._formData._sound_media_descriptor;
      const normalizeId = (value) => (typeof value === "string" ? value.trim() : "");
      const currentId = normalizeId(currentDescriptor.media_content_id || currentDescriptor.id);
      const targetId = normalizeId(
        descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id
      );
      if (currentId && targetId && currentId !== targetId) {
        this._debugDlna("Skip DLNA metadata apply: descriptor changed", {
          currentId,
          targetId,
        });
        return;
      }

      const merged = {
        ...currentDescriptor,
        media_content_provider: currentDescriptor.media_content_provider || metadata.provider || "dlna_dms",
      };
      const meta = {
        ...(currentDescriptor.metadata || {}),
      };

      this._debugDlna("Applying DLNA metadata", {
        descriptor: this._summarizeDlnaDescriptor(merged, item),
        metadata: this._summarizeDlnaMetadata(metadata),
      });

      if (metadata.media_content_type && !merged.media_content_type) {
        merged.media_content_type = metadata.media_content_type;
      }
      if (metadata.title && !merged.title) {
        merged.title = metadata.title;
      }
      if (metadata.display_title) {
        merged.media_content_title = metadata.display_title;
      } else if (metadata.title && !merged.media_content_title) {
        merged.media_content_title = metadata.title;
      }
      if (metadata.thumb && !merged.thumbnail) {
        merged.thumbnail = metadata.thumb;
      }
      if (metadata.artist) {
        meta.artist = meta.artist || metadata.artist;
        meta.artist_name = meta.artist_name || metadata.artist;
        if (!Array.isArray(meta.artists) || !meta.artists.length) {
          meta.artists = [metadata.artist];
        }
      }
      if (metadata.album) {
        meta.album = meta.album || metadata.album;
        meta.album_name = meta.album_name || metadata.album;
      }
      if (metadata.duration && !meta.duration) {
        meta.duration = metadata.duration;
      }
      merged.metadata = meta;

      this._suppressDlnaMetadataUpdate = true;
      try {
        this._updateFormField("_sound_media_descriptor", merged);
        const resolvedTitle = merged.media_content_title || metadata.display_title || metadata.title;
        if (resolvedTitle && resolvedTitle !== this._formData.sound_media_title) {
          this._updateFormField("sound_media_title", resolvedTitle);
        }
        this._debugDlna("Updated form with DLNA metadata", {
          descriptor: this._summarizeDlnaDescriptor(merged, item),
          resolvedTitle,
        });
      } finally {
        this._suppressDlnaMetadataUpdate = false;
      }
    }
  _determineSpotifyPlusLookupTarget(descriptor, item) {
    const typeCandidates = [
      descriptor?.media_content_type,
      descriptor?.type,
      item?.media_content_type,
      item?.media_class,
      this._formData.sound_media_type,
    ];
    let parsed = this._parseSpotifyIdentifier(
      descriptor?.media_content_id || descriptor?.id || item?.media_content_id || item?.id || this._formData.sound_media_id,
      typeCandidates.find((entry) => typeof entry === "string" && entry.trim())
    );
    if (!parsed) {
      return null;
    }
    let lookupType = parsed.type;
    if (!lookupType) {
      const fallbackType = typeCandidates.find((entry) => typeof entry === "string" && entry.trim());
      lookupType = this._normalizeMediaClass(fallbackType) || "";
      if (lookupType) {
        parsed = { ...parsed, type: lookupType };
      }
    }
    const normalizedType = this._mapSpotifyPlusLookupType(lookupType);
    if (!normalizedType || !parsed.id) {
      return null;
    }
    const serviceMap = {
      track: { service: "get_track", idField: "track_id" },
      album: { service: "get_album", idField: "album_id" },
      artist: { service: "get_artist", idField: "artist_id" },
      playlist: { service: "get_playlist", idField: "playlist_id" },
    };
    const config = serviceMap[normalizedType];
    if (!config) {
      return null;
    }
    const lookup = {
      ...config,
      type: normalizedType,
      id: parsed.id,
    };
    this._debugSpotify("Determined SpotifyPlus lookup target", {
      lookup,
      parsed,
    });
    return lookup;
  }
  async _callSpotifyPlusService(player, service, data = {}) {
    if (!this.hass || !player || !service) {
      return null;
    }
    const request = {
      type: "call_service",
      domain: "spotifyplus",
      service,
      service_data: {
        entity_id: player,
        ...data,
      },
      return_response: true,
    };
    try {
      this._debugSpotify("Invoking SpotifyPlus service", {
        service,
        player,
        data,
      });
      const response = await this.hass.callWS(request);
      this._debugSpotify("SpotifyPlus service raw response", {
        service,
        response,
      });
      const unwrapped = this._unwrapSpotifyPlusResponse(response);
      this._debugSpotify("SpotifyPlus service unwrapped payload", {
        service,
        payload: this._summarizeSpotifyResult(unwrapped) || unwrapped,
      });
      return unwrapped;
    } catch (err) {
      console.warn("SpotifyPlus service call failed", err);
      this._debugSpotify("SpotifyPlus service call threw", {
        service,
        error: err?.message || String(err),
      });
      return null;
    }
  }
  _applySpotifyPlusMetadata(descriptor, item, result, lookupType) {
    if (!result) {
      return;
    }
    const currentDescriptor = this._formData?._sound_media_descriptor;
    if (!currentDescriptor) {
      this._debugSpotify("Skip metadata application: no current descriptor", {
        pendingDescriptor: this._summarizeSpotifyDescriptor(descriptor),
      });
      return;
    }
    const targetId = this._normalizeMediaPlayerValue(descriptor.media_content_id || descriptor.id || "");
    const currentId = this._normalizeMediaPlayerValue(currentDescriptor.media_content_id || currentDescriptor.id || "");
    if (!targetId || targetId !== currentId) {
      this._debugSpotify("Skip metadata application: descriptor changed", {
        targetId,
        currentId,
      });
      return;
    }
    this._debugSpotify("Merging Spotify metadata", {
      lookupType,
      descriptor: this._summarizeSpotifyDescriptor(currentDescriptor),
      result: this._summarizeSpotifyResult(result),
    });
    const merged = this._mergeSpotifyPlusResult(currentDescriptor, result, lookupType);
    if (!merged) {
      this._debugSpotify("Merge produced no result", { lookupType });
      return;
    }
    this._suppressSpotifyMetadataUpdate = true;
    try {
      this._updateFormField("_sound_media_descriptor", merged);
    } finally {
      this._suppressSpotifyMetadataUpdate = false;
    }
    const updatedTitle = this._buildSelectedMediaTitle(merged, item);
    if (updatedTitle && updatedTitle !== this._formData.sound_media_title) {
      this._suppressSpotifyMetadataUpdate = true;
      try {
        this._updateFormField("sound_media_title", updatedTitle);
        this._debugSpotify("Updated sound media title", {
          title: updatedTitle,
        });
      } finally {
        this._suppressSpotifyMetadataUpdate = false;
      }
    } else {
      this._debugSpotify("No title update necessary", {
        updatedTitle,
        currentTitle: this._formData.sound_media_title,
      });
    }
  }
  _mergeSpotifyPlusResult(descriptor, result, lookupType) {
    if (!descriptor || !result) {
      return null;
    }
    this._debugSpotify("Merging SpotifyPlus result", {
      lookupType,
      descriptor: this._summarizeSpotifyDescriptor(descriptor),
      result: this._summarizeSpotifyResult(result),
    });
    const next = {
      ...descriptor,
    };
    if (!next.media_content_provider) {
      next.media_content_provider = descriptor.media_content_provider || result.media_content_provider || "spotify";
    }
    const metadata = {
      ...(descriptor.metadata || {}),
    };
    const title = result.name || result.title || metadata.title;
    if (title) {
      next.media_content_title = next.media_content_title || title;
      next.title = next.title || title;
      metadata.title = metadata.title || title;
      metadata.name = metadata.name || title;
    }
    const artists = this._collectSpotifyPlusArtistNames(result, lookupType);
    if (artists.length) {
      metadata.artist = metadata.artist || artists[0];
      metadata.artist_name = metadata.artist_name || artists[0];
      metadata.artists = metadata.artists && metadata.artists.length ? metadata.artists : artists;
    }
    if (lookupType === "track" && result.album?.name) {
      metadata.album = metadata.album || result.album.name;
      metadata.album_name = metadata.album_name || result.album.name;
    }
    const thumb =
      result.image_url ||
      (Array.isArray(result.images) && result.images[0]?.url) ||
      result.album?.image_url ||
      (Array.isArray(result.album?.images) && result.album.images[0]?.url);
    if (thumb && !next.thumbnail) {
      next.thumbnail = thumb;
    }
    if (Object.keys(metadata).length) {
      next.metadata = metadata;
    }
    this._debugSpotify("Merged Spotify descriptor", {
      merged: this._summarizeSpotifyDescriptor(next),
    });
    return next;
  }
  _collectSpotifyPlusArtistNames(result, lookupType) {
    const names = [];
    const addName = (value) => {
      if (!value) {
        return;
      }
      const candidate = typeof value === "string" ? value : value.name;
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed && !names.includes(trimmed)) {
          names.push(trimmed);
        }
      }
    };
    if (Array.isArray(result.artists)) {
      result.artists.forEach((entry) => addName(entry));
    }
    if (!names.length && lookupType === "track" && Array.isArray(result.album?.artists)) {
      result.album.artists.forEach((entry) => addName(entry));
    }
    return names;
  }
  _mapSpotifyPlusLookupType(type) {
    const normalized = this._normalizeMediaClass(type);
    switch (normalized) {
      case "songs":
      case "song":
        return "track";
      case "albums":
        return "album";
      case "artists":
        return "artist";
      case "playlists":
        return "playlist";
      case "episodes":
        return "episode";
      case "shows":
      case "podcast":
      case "podcasts":
        return "show";
      default:
        return normalized;
    }
  }
  _parseSpotifyIdentifier(value, fallbackType = "") {
    if (!value || typeof value !== "string") {
      return null;
    }
    let working = value.trim();
    if (!working) {
      return null;
    }
    let type = "";
    let id = "";
    const KNOWN_TYPES = new Set(["track", "album", "artist", "playlist", "show", "episode"]);
    const stripQuery = (payload) => payload.replace(/[?#].*$/, "");
    const attemptAssign = (candidateType, candidateId) => {
      if (!candidateType || !candidateId) {
        return;
      }
      type = candidateType;
      id = candidateId;
    };
    const assignFromParts = (parts) => {
      for (let index = 0; index < parts.length; index += 1) {
        const segment = parts[index];
        const lowered = segment?.toLowerCase?.();
        if (!lowered) {
          continue;
        }
        if (lowered === "user") {
          // Skip username segment
          index += 1;
          continue;
        }
        if (KNOWN_TYPES.has(lowered)) {
          const candidateId = parts[index + 1];
          attemptAssign(lowered, candidateId);
          break;
        }
      }
    };
    const lowered = working.toLowerCase();
    if (lowered.startsWith("media-source://spotify/")) {
      const withoutScheme = stripQuery(working.slice("media-source://spotify/".length));
      const parts = withoutScheme.split(/[\/]/).filter(Boolean);
      assignFromParts(parts);
    } else if (lowered.startsWith("spotify://")) {
      const withoutScheme = stripQuery(working.slice("spotify://".length));
      const parts = withoutScheme.split(/[\/]/).filter(Boolean);
      assignFromParts(parts);
    } else if (lowered.startsWith("spotify:")) {
      const parts = working.split(":").filter(Boolean);
      assignFromParts(parts.slice(1));
    } else if (lowered.startsWith("https://open.spotify.com/")) {
      try {
        const url = new URL(working);
        const segments = url.pathname.split("/").filter(Boolean);
        assignFromParts(segments);
        if (!id && segments.length >= 2) {
          attemptAssign(segments[0], segments[1]);
        }
      } catch (err) {
        /* invalid URL */
      }
    } else if (/^[a-z0-9]{22}$/i.test(working)) {
      id = working;
      type = fallbackType || "";
    }
    if (!id) {
      return null;
    }
    if (!type) {
      type = this._normalizeMediaClass(fallbackType);
    }
    return {
      id,
      type,
      uri: type ? `spotify:${type}:${id}` : working,
    };
  }
  _handleMediaPlayerChange(nextPlayer, prevPlayer, prevForm) {
    const isSpotify = this._isSpotifyPlayer(nextPlayer);
    const wasSpotify = this._isSpotifyPlayer(prevPlayer);
    const updates = {};
    if (isSpotify) {
      if (!wasSpotify && prevForm) {
        this._ttsMemory = {
          message: prevForm.message || "",
          announce_time:
            prevForm.announce_time === undefined ? true : !!prevForm.announce_time,
          announce_name:
            prevForm.announce_name === undefined ? true : !!prevForm.announce_name,
        };
      }
      if (!this._ttsMemory) {
        this._ttsMemory = {
          message: this._formData.message || "",
          announce_time: !!this._formData.announce_time,
          announce_name: !!this._formData.announce_name,
        };
      }
      if (this._formData.message) {
        updates.message = "";
      }
      if (this._formData.announce_time) {
        updates.announce_time = false;
      }
      if (this._formData.announce_name) {
        updates.announce_name = false;
      }
      const sources = this._getSpotifySourcesForPlayer(nextPlayer);
      const normalizedCurrent = this._normalizeSpotifySourceValue(this._formData.spotify_source);
      if (sources.length) {
        if (!normalizedCurrent || !sources.includes(normalizedCurrent)) {
          updates.spotify_source = sources[0];
        }
      } else if (normalizedCurrent) {
        updates.spotify_source = "";
      }
    } else {
      if (wasSpotify) {
        const memory = this._ttsMemory || {};
        updates.message = memory.message || "";
        updates.announce_time =
          memory.announce_time === undefined ? true : !!memory.announce_time;
        updates.announce_name =
          memory.announce_name === undefined ? true : !!memory.announce_name;
        this._ttsMemory = null;
      }
      if (this._formData.spotify_source) {
        updates.spotify_source = "";
      }
    }
    if (Object.keys(updates).length) {
      this._formData = {
        ...this._formData,
        ...updates,
      };
    }
  }
  _enforceSpotifyDialogState() {
    const player = this._formData?.media_player;
    if (!player) {
      this._ttsMemory = null;
      return;
    }
    if (this._isSpotifyPlayer(player)) {
      this._handleMediaPlayerChange(player, null, this._formData);
    } else {
      this._ttsMemory = null;
    }
  }
  _resetPreviewState() {
    this._previewSource = null;
    this._previewCanPlay = false;
    this._previewPlaying = false;
    this._previewLoading = false;
    this._previewError = "";
    this._previewRequestId = 0;
    this._previewUrl = "";
  }
  _refreshMediaPreviewState() {
    const nextSource = this._getPreviewSourceInfo(this._formData);
    const prevKey = this._previewSource ? this._previewSource.key : "";
    const nextKey = nextSource ? nextSource.key : "";
    if (prevKey !== nextKey && this._previewPlaying) {
      this._stopMediaPreview();
    }
    if (prevKey !== nextKey) {
      this._previewError = "";
    }
    this._previewSource = nextSource;
    this._previewCanPlay = !!nextSource;
    if (!nextSource) {
      this._previewError = "";
    }
  }
  _getPreviewSourceInfo(form = this._formData) {
    if (!form) {
      return null;
    }
    const descriptor = form._sound_media_descriptor;
    const descriptorId = typeof descriptor?.media_content_id === "string" ? descriptor.media_content_id : undefined;
    const descriptorKind = typeof descriptor?.kind === "string" ? descriptor.kind.toLowerCase() : "";
    const descriptorUrl = typeof descriptor?.resolved_url === "string" ? descriptor.resolved_url : undefined;
    const descriptorType =
      typeof descriptor?.media_content_type === "string"
        ? descriptor.media_content_type
        : typeof descriptor?.type === "string"
            ? descriptor.type
            : "";
    let mediaId = typeof form.sound_media_id === "string" ? form.sound_media_id.trim() : "";
    if (!mediaId && descriptorId) {
      mediaId = descriptorId;
    }
    const mediaType = typeof form.sound_media_type === "string" && form.sound_media_type.trim()
      ? form.sound_media_type.trim()
      : descriptorType;
    let fallbackUrl = descriptorUrl || "";
    if (!mediaId && !fallbackUrl) {
      return null;
    }
    const previewId = mediaId || fallbackUrl;
    const candidateValues = [mediaId, descriptorId, fallbackUrl].filter((entry) => typeof entry === "string" && entry);
    const explicitMediaSource = candidateValues.find((value) => value.startsWith("media-source://"));
    if (explicitMediaSource && mediaId !== explicitMediaSource) {
      mediaId = explicitMediaSource;
    }
    const lowerId = previewId.toLowerCase();
    const httpRegex = /^https?:\/\//i;
    const hasHttp = httpRegex.test(previewId) || httpRegex.test(fallbackUrl);
    const isMediaSource = !!explicitMediaSource;
    const localPrefixes = ["/media/", "/local/", "media/", "local/"];
    const hasLocalPrefix = localPrefixes.some((prefix) => lowerId.startsWith(prefix));
    const hasSchemeMatch = previewId.match(/^([a-z0-9+.-]+):/i);
    const scheme = hasSchemeMatch ? hasSchemeMatch[1].toLowerCase() : "";
    const unsupportedSchemes = ["mass", "ma", "spotify", "tidal", "ytmusic", "qobuz", "deezer"];
    if (descriptorKind === "music_assistant" || unsupportedSchemes.includes(scheme)) {
      return null;
    }
    const looksLocal =
      !isMediaSource &&
      !hasHttp &&
      (hasLocalPrefix || (!scheme && !!previewId && (previewId.includes("/") || previewId.includes("."))));
    const resolvedLocal = !hasHttp && fallbackUrl.startsWith("/");
    const isLocalCandidate = looksLocal || resolvedLocal;
    if (!isMediaSource && !hasHttp && !isLocalCandidate) {
      return null;
    }
    const kind = isMediaSource ? "media_source" : hasHttp ? "external_url" : "file";
    const key = `${kind}|${mediaId || ""}|${fallbackUrl}`;
    return {
      key,
      kind,
      mediaId,
      resolvedUrl: fallbackUrl,
      mediaType,
      path: previewId,
    };
  }
  _renderMediaPreviewControls() {
    if (!this._previewCanPlay) {
      return nothing;
    }
    const playClasses = classMap({
      "media-preview-button": true,
      playing: this._previewPlaying,
      loading: this._previewLoading,
    });
    return html`
      <div class="media-preview-controls">
        <button
          type="button"
          class=${playClasses}
          title="Play preview"
          @click=${this._handlePreviewPlay}
          ?disabled=${this._previewLoading || this._previewPlaying}
        >
          <ha-icon icon=${this._previewLoading ? "mdi:loading" : "mdi:play"}></ha-icon>
        </button>
        <button
          type="button"
          class="media-preview-button"
          title="Stop preview"
          @click=${this._handlePreviewStop}
          ?disabled=${!this._previewPlaying && !this._previewLoading}
        >
          <ha-icon icon="mdi:stop"></ha-icon>
        </button>
      </div>
    `;
  }
  async _handlePreviewPlay() {
    if (!this._previewCanPlay || this._previewLoading || this._previewPlaying) {
      return;
    }
    const source = this._previewSource || this._getPreviewSourceInfo();
    if (!source) {
      return;
    }
    this._previewLoading = true;
    this._previewError = "";
    const requestId = ++this._previewRequestId;
    try {
      const { url } = await this._resolvePreviewUrl(source);
      if (!url) {
        throw new Error("Preview URL unavailable");
      }
      const audio = this._ensurePreviewAudio();
      if (audio.src !== url) {
        audio.src = url;
      }
      audio.currentTime = 0;
      await audio.play();
      if (this._previewRequestId !== requestId) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      this._previewPlaying = true;
      this._previewUrl = url;
    } catch (err) {
      console.error("Failed to play media preview", err);
      this._previewPlaying = false;
      this._previewError = err?.message || "Unable to play media preview";
    } finally {
      this._previewLoading = false;
      this.requestUpdate();
    }
  }
  _handlePreviewStop = () => {
    this._stopMediaPreview();
    this.requestUpdate();
  };
  _stopMediaPreview() {
    this._previewRequestId++;
    if (this._previewAudio) {
      try {
        this._previewAudio.pause();
        this._previewAudio.currentTime = 0;
      } catch (err) {
        console.warn("Unable to reset preview audio", err);
      }
    }
    this._previewPlaying = false;
    this._previewLoading = false;
    this._previewUrl = "";
  }
  _ensurePreviewAudio() {
    if (!this._previewAudio) {
      this._previewAudio = new Audio();
      this._previewAudio.addEventListener("ended", () => {
        this._previewPlaying = false;
        this.requestUpdate();
      });
      this._previewAudio.addEventListener("error", () => {
        this._previewPlaying = false;
        this._previewError = "Media preview failed";
        this.requestUpdate();
      });
    }
    return this._previewAudio;
  }
  async _resolvePreviewUrl(source) {
    if (!source) {
      return { url: "", mime: "" };
    }
    if (!this.hass) {
      throw new Error("Home Assistant connection unavailable");
    }
    if (source.kind !== "media_source") {
      const derivedId = this._buildMediaSourceIdFromPath(source.mediaId || source.resolvedUrl || source.path || "");
      if (derivedId) {
        try {
          const result = await this.hass.callWS({
            type: "media_source/resolve_media",
            media_content_id: derivedId,
          });
          const derivedUrl = this._toAbsoluteUrl(result?.url || result?.media_content_id || "");
          if (derivedUrl) {
            return {
              url: derivedUrl,
              mime: result?.mime_type || result?.content_type || source.mediaType || "",
            };
          }
        } catch (err) {
          console.warn("Preview fallback resolve failed", err);
        }
      }
    }
    if (source.kind === "media_source" && source.mediaId) {
      const request = {
        type: "media_source/resolve_media",
        media_content_id: source.mediaId,
      };
      const result = await this.hass.callWS(request);
      const resolvedUrl = this._toAbsoluteUrl(result?.url || result?.media_content_id || "");
      if (!resolvedUrl) {
        throw new Error("Unable to resolve media source");
      }
      return {
        url: resolvedUrl,
        mime: result?.mime_type || result?.content_type || source.mediaType || "",
      };
    }
    const candidate = source.resolvedUrl || source.mediaId;
    const absolute = this._toAbsoluteUrl(candidate);
    if (!absolute) {
      throw new Error("Preview URL unavailable");
    }
    return {
      url: absolute,
      mime: source.mediaType || "",
    };
  }
  _buildMediaSourceIdFromPath(candidate) {
    if (!candidate || typeof candidate !== "string") {
      return "";
    }
    let value = candidate.trim();
    if (!value) {
      return "";
    }
    if (value.startsWith("media-source://")) {
      return value;
    }
    const urlMatch = value.match(/^https?:\/\/[^/]+(\/.*)$/i);
    if (urlMatch) {
      value = urlMatch[1];
    }
    if (!value.startsWith("/")) {
      value = `/${value}`;
    }
    let relative = value.replace(/^\/+/, "");
    if (relative.startsWith("media/")) {
      relative = relative.slice("media/".length);
      if (!relative.startsWith("local/")) {
        relative = `local/${relative}`;
      }
    } else if (relative.startsWith("local/")) {
      // already rooted in the local media directory
    } else if (relative.startsWith("media_source/")) {
      relative = relative.slice("media_source/".length);
    } else {
      return "";
    }
    if (!relative) {
      return "";
    }
    return `media-source://media_source/${relative}`;
  }
  _toAbsoluteUrl(candidate) {
    if (!candidate) {
      return "";
    }
    if (candidate.startsWith("media-source://")) {
      return "";
    }
    try {
      const parsed = new URL(candidate);
      return parsed.href;
    } catch (err) {
      /* not an absolute URL */
    }
    if (typeof this.hass?.hassUrl === "function") {
      return this.hass.hassUrl(candidate);
    }
    try {
      return new URL(candidate, window.location.origin).href;
    } catch (err) {
      return "";
    }
  }
  _toggleRepeatDay(day) {
    const current = new Set(this._formData.repeat_days || []);
    if (current.has(day)) {
      current.delete(day);
    } else {
      current.add(day);
    }
    this._updateFormField("repeat_days", Array.from(current));
  }
  async _submitForm() {
    if (this._saving) {
      return;
    }
    const errors = this._validateForm();
    if (errors.length) {
      this._dialogError = errors.join(". ");
      return;
    }
    this._dialogError = "";
    this._saving = true;
    try {
      const payload = this._buildServicePayload();
      if (this._dialogMode === "edit" && this._formData.alarm_id) {
        await this._callIntegrationService("edit_alarm", payload);
        this._notify("Alarm updated");
      } else {
        await this._callIntegrationService("set_alarm", payload);
        this._notify("Alarm created");
      }
      this._closeDialog();
    } catch (err) {
      this._dialogError = err?.message || "Failed to save alarm";
      this._saving = false;
    }
  }
  async _deleteAlarm() {
    if (!this._formData.alarm_id || this._saving) {
      return;
    }
    if (!confirm("Delete this alarm?")) {
      return;
    }
    this._dialogError = "";
    this._saving = true;
    try {
      await this._callIntegrationService("delete_alarm", {
        alarm_id: this._formData.alarm_id,
      });
      this._notify("Alarm deleted");
      this._closeDialog();
    } catch (err) {
      this._dialogError = err?.message || "Failed to delete alarm";
      this._saving = false;
    }
  }
  _validateForm() {
    const errors = [];
    if (!this._formData.time) {
      errors.push("Pick a time");
    }
    if (!this._formData.media_player) {
      errors.push("Select a media player");
    }
    if (this._formData.repeat === "custom" && !(this._formData.repeat_days || []).length) {
      errors.push("Choose at least one repeat day");
    }
    const allowedEntities = this._getAllowedActivationEntities();
    if (
      allowedEntities.length &&
      this._formData.activation_entity &&
      !allowedEntities.includes(this._formData.activation_entity)
    ) {
      errors.push("Activation entity must be from the allowed list");
    }
    if (this._isSpotifyPlayer(this._formData.media_player)) {
      const sources = this._getSpotifySourcesForPlayer(this._formData.media_player);
      if (!sources.length) {
        errors.push("This Spotify player doesn't have any available sources yet.");
      } else {
        const normalized = this._normalizeSpotifySourceValue(this._formData.spotify_source);
        if (!normalized) {
          errors.push("Select a Spotify source for this player.");
        }
      }
    }
    return errors;
  }
  _buildServicePayload() {
    const mediaPlayer = this._normalizeMediaPlayerValue(this._formData.media_player);
    const repeat = this._normalizeRepeatValue(this._formData.repeat);
    const repeatDays = this._normalizeRepeatDaysList(this._formData.repeat_days);
    const nameInput = typeof this._formData.name === "string" ? this._formData.name.trim() : "";
    const data = {
      time: this._formData.time,
      name: nameInput || undefined,
      message: this._formData.message || undefined,
      date: this._formData.date || undefined,
      repeat,
      media_player: mediaPlayer,
      announce_time: !!this._formData.announce_time,
      announce_name: !!this._formData.announce_name,
      activation_entity: this._formData.activation_entity || undefined,
    };
    if (this._isSpotifyPlayer(mediaPlayer)) {
      const spotifySource = this._normalizeSpotifySourceValue(this._formData.spotify_source);
      if (spotifySource) {
        data.spotify_source = spotifySource;
      }
    }
    data.repeat_days = repeat === "custom" ? repeatDays : undefined;
    const soundMediaId = this._normalizeMediaPlayerValue(this._formData.sound_media_id);
    const soundMediaType = typeof this._formData.sound_media_type === "string" ? this._formData.sound_media_type.trim() : "";
    const soundMediaTitle =
      typeof this._formData.sound_media_title === "string" ? this._formData.sound_media_title.trim() : "";
    const isEdit = this._dialogMode === "edit" && this._formData.alarm_id;
    let includeSoundMedia = false;
    if (soundMediaId) {
      if (isEdit) {
        const originalId = this._normalizeMediaPlayerValue(this._formData._original_sound_media_id);
        const originalType =
          typeof this._formData._original_sound_media_type === "string"
            ? this._formData._original_sound_media_type.trim()
            : "";
        const originalTitle =
          typeof this._formData._original_sound_media_title === "string"
            ? this._formData._original_sound_media_title.trim()
            : "";
        const idChanged = soundMediaId !== originalId;
        const typeChanged = soundMediaType !== originalType;
        const titleChanged = soundMediaTitle !== originalTitle;
        if (idChanged || typeChanged || titleChanged) {
          includeSoundMedia = true;
        }
      } else {
        includeSoundMedia = true;
      }
    }
    if (includeSoundMedia) {
      const descriptor = this._formData._sound_media_descriptor;
      const payload = {
        media_content_id: soundMediaId,
      };
      const descriptorMatches =
        descriptor &&
        this._normalizeMediaPlayerValue(descriptor.media_content_id || descriptor.id || "") === soundMediaId;
      const resolvedType = soundMediaType || descriptor?.media_content_type || descriptor?.type || "";
      if (resolvedType) {
        payload.media_content_type = resolvedType;
      }
      const descriptorTitle = descriptorMatches
        ? descriptor.media_content_title || descriptor.title || ""
        : "";
      const resolvedTitle = soundMediaTitle || descriptorTitle;
      if (resolvedTitle) {
        payload.media_content_title = resolvedTitle;
      }
      if (descriptorMatches) {
        const title = descriptor.media_content_title || descriptor.title;
        if (descriptor.metadata && typeof descriptor.metadata === "object") {
          payload.metadata = descriptor.metadata;
        }
        if (descriptor.thumbnail) {
          payload.thumbnail = descriptor.thumbnail;
        }
        if (descriptor.media_content_provider) {
          payload.media_content_provider = descriptor.media_content_provider;
        }
        const storedPath = this._sanitizeMediaBrowserPath(descriptor.media_browser_path);
        if (storedPath.length) {
          payload.media_browser_path = storedPath.map((entry) => ({ ...entry }));
        }
      }
      data.sound_media = payload;
    }
    if (this._dialogMode === "edit" && this._formData.alarm_id) {
      data.alarm_id = this._formData.alarm_id;
    }
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    return data;
  }
  _mediaPlayerOptions() {
    if (!this.hass) {
      return [];
    }
    return Object.values(this.hass.states)
      .filter((state) => state.entity_id.startsWith("media_player."))
      .map((state) => {
        const descriptor = this._describeMediaPlayer(state.entity_id, state);
        return {
          entity_id: state.entity_id,
          name: descriptor.friendlyName || state.attributes.friendly_name || state.entity_id,
          label: descriptor.label,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  _detectMediaPlayerFamily(entityId) {
    if (!entityId || !this.hass) {
      return "unknown";
    }
    const stateObj = this.hass.states?.[entityId];
    const attrs = stateObj?.attributes || {};
    const registryEntry = this.hass.entities?.[entityId];
    const platform = typeof registryEntry?.platform === "string" ? registryEntry.platform.toLowerCase() : "";
    if (platform && SPOTIFY_PLATFORM_SET.has(platform)) {
      return MEDIA_PLAYER_FAMILY_SPOTIFY;
    }
    if (
      platform === MEDIA_PLAYER_FAMILY_MUSIC_ASSISTANT ||
      attrs.mass_player_type ||
      attrs.mass_provider ||
      attrs.ma_source
    ) {
      return MEDIA_PLAYER_FAMILY_MUSIC_ASSISTANT;
    }
    if (platform && platform.includes("spotify")) {
      return MEDIA_PLAYER_FAMILY_SPOTIFY;
    }
    if (typeof entityId === "string" && entityId.startsWith("media_player.spotify")) {
      return MEDIA_PLAYER_FAMILY_SPOTIFY;
    }
    return "home_assistant";
  }
  _isSpotifyPlayer(entityId) {
    return this._detectMediaPlayerFamily(entityId) === MEDIA_PLAYER_FAMILY_SPOTIFY;
  }
  _isSpotifyPlusPlayer(entityId) {
    if (!entityId) {
      return false;
    }
    const platform = this._getMediaPlayerPlatform(entityId);
    return platform === "spotifyplus";
  }
  _resolveSpotifyMetadataPlayer(preferredPlayer) {
    const normalizedPreferred = this._normalizeMediaPlayerValue(preferredPlayer);
    if (normalizedPreferred && this._isSpotifyPlusPlayer(normalizedPreferred)) {
      return normalizedPreferred;
    }
    const candidates = this._getSpotifyPlusPlayers();
    if (!candidates.length) {
      return "";
    }
    if (normalizedPreferred) {
      const preferredSuffix = normalizedPreferred.replace(/^media_player\./, "");
      const matched = candidates.find((candidate) => candidate.endsWith(preferredSuffix));
      if (matched) {
        return matched;
      }
    }
    return candidates[0];
  }
  _getSpotifyPlusPlayers() {
    if (!this.hass?.entities) {
      return [];
    }
    return Object.keys(this.hass.entities)
      .filter((entityId) => entityId.startsWith("media_player.") && this._isSpotifyPlusPlayer(entityId))
      .sort();
  }
  _playerSupportsMediaBrowser(entityId) {
    if (!entityId) {
      return false;
    }
    const platform = this._getMediaPlayerPlatform(entityId);
    if (platform && SPOTIFY_BROWSE_BLOCKED_PLATFORMS.has(platform)) {
      return false;
    }
    if (!platform && entityId.startsWith("media_player.spotify")) {
      return false;
    }
    return true;
  }
  _normalizeSpotifySourceValue(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).trim();
    }
    if (typeof value === "object" && value !== null) {
      return this._normalizeSpotifySourceValue(value.value || value.name || value.label || "");
    }
    return "";
  }
  _getSpotifySourcesForPlayer(entityId) {
    if (!entityId || !this.hass) {
      return [];
    }
    const collected = [];
    const append = (candidate) => {
      const normalized = this._normalizeSpotifySourceValue(candidate);
      if (normalized && !collected.includes(normalized)) {
        collected.push(normalized);
      }
    };
    const extend = (container) => {
      if (!container) {
        return;
      }
      if (Array.isArray(container)) {
        container.forEach((entry) => extend(entry));
        return;
      }
      if (typeof container === "object") {
        Object.values(container).forEach((entry) => extend(entry));
        return;
      }
      append(container);
    };
    const state = this.hass.states?.[entityId];
    extend(state?.attributes?.source_list);
    append(state?.attributes?.source);
    return collected;
  }
  _activationOptions() {
    const existing = new Set(this._getAllowedActivationEntities());
    const dynamic = this._buildAlarmModels()
      .map((alarm) => alarm.activation_entity)
      .filter(Boolean);
    dynamic.forEach((entity) => existing.add(entity));
    const currentFormValue =
      typeof this._formData?.activation_entity === "string"
        ? this._formData.activation_entity.trim()
        : "";
    if (currentFormValue) {
      existing.add(currentFormValue);
    }
    return Array.from(existing)
      .map((entityId) => ({
        value: entityId,
        label: this._formatEntityName(entityId),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  _formatEntityName(entityId) {
    if (!entityId || !this.hass) {
      return "";
    }
    return this.hass.states?.[entityId]?.attributes?.friendly_name || entityId;
  }
  _formatMediaPlayerLabel(entityId) {
    if (!entityId || !this.hass) {
      return "-";
    }
    const { label } = this._describeMediaPlayer(entityId);
    return label || "-";
  }
  _normalizeRepeatDaysList(days) {
    if (!Array.isArray(days)) {
      return [];
    }
    const seen = new Set();
    const normalized = [];
    for (const entry of days) {
      if (typeof entry !== "string") {
        continue;
      }
      const trimmed = entry.trim().toLowerCase();
      if (!trimmed || !DAY_LABELS[trimmed] || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  }
  _normalizeRepeatValue(value) {
    if (typeof value !== "string") {
      return "once";
    }
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return "once";
    }
    const alias = REPEAT_ALIASES[trimmed];
    if (alias) {
      return alias;
    }
    return VALID_REPEAT_VALUES.has(trimmed) ? trimmed : "once";
  }
  _normalizeMediaPlayerValue(value) {
    if (!value) {
      return "";
    }
    if (Array.isArray(value)) {
      const first = value.find((entry) => entry);
      return this._normalizeMediaPlayerValue(first);
    }
    if (typeof value === "object") {
      if (value.entity_id) {
        return this._normalizeMediaPlayerValue(value.entity_id);
      }
      if (value.entityId) {
        return this._normalizeMediaPlayerValue(value.entityId);
      }
      if (value.id) {
        return this._normalizeMediaPlayerValue(value.id);
      }
      if (value.target) {
        return this._normalizeMediaPlayerValue(value.target);
      }
      return "";
    }
    return String(value).trim();
  }
  _getInitialMediaBrowserPath() {
    const descriptor = this._formData?._sound_media_descriptor;
    const base = {
      path: [],
      keys: [],
      canonicalId: "",
      mediaType: "",
      fromCache: false,
      pathSource: "",
    };
    if (!descriptor) {
      return base;
    }
    const rawId = descriptor.media_content_id || this._formData?.sound_media_id || "";
    const canonicalId = this._normalizeMediaBrowserId(rawId);
    if (!canonicalId) {
      return base;
    }
    const rawType = descriptor.media_content_type || descriptor.type || this._formData?.sound_media_type || "";
    const keys = this._collectMediaBrowserKeys(canonicalId, rawType);
    const common = {
      ...base,
      keys,
      canonicalId,
      mediaType: rawType,
    };
    for (const key of keys) {
      const stored = key ? this._mediaBrowserSelectionPaths.get(key) : undefined;
      if (stored && stored.length) {
        return {
          ...common,
          path: stored.map((entry) => ({ ...entry })),
          fromCache: true,
          pathSource: "session",
        };
      }
    }
    const persistedPath = this._sanitizeMediaBrowserPath(descriptor.media_browser_path);
    if (persistedPath.length) {
      return {
        ...common,
        path: persistedPath.map((entry) => ({ ...entry })),
        pathSource: "descriptor",
      };
    }
    return common;
  }
  _recordMediaBrowserPathForSelection(id, type, pathOverride = null) {
    const canonicalId = this._normalizeMediaBrowserId(id);
    if (!canonicalId) {
      return [];
    }
    const sourcePath = Array.isArray(pathOverride) ? pathOverride : this._cloneBreadcrumbDescriptors();
    const sanitized = this._sanitizeMediaBrowserPath(sourcePath);
    if (!sanitized.length) {
      return [];
    }
    const normalizedPath = sanitized.map((entry) => ({ id: entry.id, type: entry.type }));
    const keys = this._collectMediaBrowserKeys(canonicalId, type);
    if (keys.length) {
      keys.forEach((key) => {
        if (key) {
          this._mediaBrowserSelectionPaths.set(
            key,
            normalizedPath.map((entry) => ({ id: entry.id, type: entry.type }))
          );
        }
      });
    }
    return normalizedPath.map((entry) => ({ id: entry.id, type: entry.type }));
  }
  _sanitizeMediaBrowserPath(path) {
    if (!Array.isArray(path)) {
      return [];
    }
    const sanitized = [];
    const seen = new Set();
    for (const entry of path) {
      if (!entry) {
        continue;
      }
      let entryId = "";
      if (typeof entry === "string") {
        entryId = entry;
      } else if (typeof entry.id === "string") {
        entryId = entry.id;
      }
      const normalizedId = this._normalizeMediaBrowserId(entryId);
      if (!normalizedId || seen.has(normalizedId)) {
        continue;
      }
      const entryType = typeof entry?.type === "string" && entry.type ? entry.type : undefined;
      sanitized.push({ id: normalizedId, type: entryType });
      seen.add(normalizedId);
    }
    return sanitized;
  }
  _normalizeMediaBrowserId(value) {
    if (!value || typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("media-source://")) {
      return trimmed;
    }
    const converted = this._buildMediaSourceIdFromPath(trimmed);
    if (converted && converted.startsWith("media-source://")) {
      return converted;
    }
    return trimmed;
  }
  _readSpotifyDebugPreference() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const value = window.localStorage.getItem("alarmsCardSpotifyDebug");
      if (value === null) {
        return false;
      }
      const lowered = value.toLowerCase();
      return lowered === "1" || lowered === "true" || lowered === "yes";
    } catch (err) {
      console.warn("Unable to read Spotify debug preference", err);
      return false;
    }
  }
  _debugSpotify(message, data = undefined) {
    if (!this._spotifyDebugEnabled) {
      return;
    }
    const label = "[alarms-card][spotify]";
    if (data !== undefined) {
      console.debug(label, message, data);
    } else {
      console.debug(label, message);
    }
  }
  _readPlexDebugPreference() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const value = window.localStorage.getItem("alarmsCardPlexDebug");
      if (value === null) {
        return false;
      }
      const lowered = value.toLowerCase();
      return lowered === "1" || lowered === "true" || lowered === "yes";
    } catch (err) {
      console.warn("Unable to read Plex debug preference", err);
      return false;
    }
  }
  _debugPlex(message, data = undefined) {
    if (!this._plexDebugEnabled) {
      return;
    }
    const label = "[alarms-card][plex]";
    if (data !== undefined) {
      console.debug(label, message, data);
    } else {
      console.debug(label, message);
    }
  }
  _readDlnaDebugPreference() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const value = window.localStorage.getItem("alarmsCardDlnaDebug");
      if (value === null) {
        return false;
      }
      const lowered = value.toLowerCase();
      return lowered === "1" || lowered === "true" || lowered === "yes";
    } catch (err) {
      console.warn("Unable to read DLNA debug preference", err);
      return false;
    }
  }
  _debugDlna(message, data = undefined) {
    if (!this._dlnaDebugEnabled) {
      return;
    }
    const label = "[alarms-card][dlna]";
    if (data !== undefined) {
      console.debug(label, message, data);
    } else {
      console.debug(label, message);
    }
  }
  _readJellyfinDebugPreference() {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return false;
      }
      const value = window.localStorage.getItem("alarmsCardJellyfinDebug");
      if (value === null) {
        return false;
      }
      const lowered = value.toLowerCase();
      return lowered === "1" || lowered === "true" || lowered === "yes";
    } catch (err) {
      console.warn("Unable to read Jellyfin debug preference", err);
      return false;
    }
  }
  _debugJellyfin(message, data = undefined) {
    if (!this._jellyfinDebugEnabled) {
      return;
    }
    const label = "[alarms-card][jellyfin]";
    if (data !== undefined) {
      console.debug(label, message, data);
    } else {
      console.debug(label, message);
    }
  }
  _summarizeSpotifyDescriptor(descriptor) {
    if (!descriptor) {
      return null;
    }
    return {
      id: descriptor.media_content_id || descriptor.id || "",
      type: descriptor.media_content_type || descriptor.type || "",
      provider: descriptor.media_content_provider || descriptor.provider || "",
      title: descriptor.media_content_title || descriptor.title || "",
      metadata: descriptor.metadata
        ? {
            title: descriptor.metadata.title,
            artist: descriptor.metadata.artist,
            artists: descriptor.metadata.artists,
            album: descriptor.metadata.album,
          }
        : undefined,
    };
  }
  _summarizeMediaItems(items, limit = 5) {
    if (!Array.isArray(items) || !items.length) {
      return [];
    }
    return items
      .slice(0, limit)
      .map((item, index) => ({ index, summary: this._summarizeMediaItem(item) || { title: item?.title } }));
  }
  _summarizeMediaItem(item) {
    if (!item) {
      return null;
    }
    return {
      id: item.media_content_id,
      type: item.media_content_type || item.media_class,
      provider: item.media_content_provider,
      title: item.title,
      subtitle: item.subtitle,
      metadata: item.metadata,
    };
  }
  _summarizePlexDescriptor(descriptor, item = null) {
    const source = descriptor || item;
    if (!source) {
      return null;
    }
    return {
      id: source.media_content_id || source.id || "",
      type: source.media_content_type || source.type || source.media_class || "",
      provider: source.media_content_provider || source.provider || "",
      title: source.media_content_title || source.title || "",
      display_title: source.media_content_title,
    };
  }
  _summarizePlexMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") {
      return metadata ?? null;
    }
    return {
      provider: metadata.provider,
      media_content_type: metadata.media_content_type,
      title: metadata.title,
      display_title: metadata.display_title,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      rating_key: metadata.rating_key,
    };
  }
  _summarizeDlnaDescriptor(descriptor, item = null) {
    const source = descriptor || item;
    if (!source) {
      return null;
    }
    return {
      id: source.media_content_id || source.id || "",
      type: source.media_content_type || source.type || source.media_class || "",
      provider: source.media_content_provider || source.provider || "",
      title: source.media_content_title || source.title || "",
      display_title: source.media_content_title,
    };
  }
  _summarizeDlnaMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") {
      return metadata ?? null;
    }
    return {
      provider: metadata.provider,
      media_content_type: metadata.media_content_type,
      title: metadata.title,
      display_title: metadata.display_title,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      has_thumb: Boolean(metadata.thumb),
    };
  }
  _summarizeJellyfinDescriptor(descriptor, item = null) {
    const source = descriptor || item;
    if (!source) {
      return null;
    }
    return {
      id: source.media_content_id || source.id || "",
      type: source.media_content_type || source.type || source.media_class || "",
      provider: source.media_content_provider || source.provider || "",
      title: source.media_content_title || source.title || "",
    };
  }
  _summarizeJellyfinMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") {
      return metadata ?? null;
    }
    return {
      provider: metadata.provider,
      media_content_type: metadata.media_content_type,
      title: metadata.title,
      display_title: metadata.display_title,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      has_thumb: Boolean(metadata.thumb),
    };
  }
  _summarizeSpotifyResult(result) {
    if (!result || typeof result !== "object") {
      return result;
    }
    const summary = {
      name: result.name || result.title,
      uri: result.uri,
      id: result.id,
      type: result.type,
      artists: Array.isArray(result.artists)
        ? result.artists.map((entry) => (typeof entry === "string" ? entry : entry?.name)).filter(Boolean)
        : undefined,
    };
    if (result.album) {
      summary.album = {
        name: result.album.name,
      };
    }
    return summary;
  }
  _unwrapSpotifyPlusResponse(payload) {
    let current = payload;
    for (let depth = 0; depth < 5; depth += 1) {
      if (!current || typeof current !== "object") {
        return current;
      }
      if (current.result !== undefined && current.result !== null) {
        current = current.result;
        continue;
      }
      if (current.response !== undefined && current.response !== null) {
        current = current.response;
        continue;
      }
      break;
    }
    return current;
  }
  _cloneBreadcrumbDescriptors() {
    const breadcrumbs = Array.isArray(this._mediaBrowserBreadcrumbs) ? this._mediaBrowserBreadcrumbs : [];
    const cloned = [];
    breadcrumbs.forEach((crumb) => {
      if (!crumb) {
        return;
      }
      const descriptor = crumb.descriptor || {};
      const id = descriptor.id ?? crumb.id;
      if (typeof id !== "string" || !id) {
        return;
      }
      const type = descriptor.type ?? crumb.type;
      cloned.push({ id, type: typeof type === "string" && type ? type : undefined });
    });
    return cloned;
  }
  _collectMediaBrowserKeys(id, type) {
    if (!id) {
      return [];
    }
    const variants = [];
    const normalizedType = typeof type === "string" ? type.trim().toLowerCase() : "";
    variants.push(normalizedType);
    if (normalizedType) {
      variants.push("");
    }
    const keys = [];
    const seen = new Set();
    variants.forEach((variant) => {
      const key = this._mediaBrowserSelectionKey(id, variant);
      if (key && !seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    });
    return keys;
  }
  _mediaBrowserSelectionKey(id, type) {
    if (!id || typeof id !== "string") {
      return "";
    }
    const normalizedType = typeof type === "string" && type ? type.trim().toLowerCase() : "";
    return `${normalizedType}|${id}`;
  }
  _describeMediaPlayer(entityId, stateOverride) {
    const state = stateOverride || this.hass?.states?.[entityId];
    const friendlyName = state?.attributes?.friendly_name || entityId || "";
    const entry = this.hass?.entities?.[entityId];
    const areaName =
      (entry?.area_id && this._lookupAreaName(entry.area_id)) ||
      state?.attributes?.room_name ||
      state?.attributes?.area;
    const platformLabel = this._formatPlatformLabel(entry?.platform);
    return {
      friendlyName,
      platformLabel,
      areaName,
      label: this._composeMediaPlayerLabel(friendlyName, platformLabel, areaName),
    };
  }
  _composeMediaPlayerLabel(friendlyName, platformLabel, areaName) {
    let label = friendlyName || "";
    if (platformLabel) {
      label += ` \u00b7 ${platformLabel}`;
    }
    if (areaName) {
      label += ` (${areaName})`;
    }
    return label || "-";
  }
  _getMediaPlayerPlatform(entityId) {
    if (!entityId || !this.hass?.entities) {
      return "";
    }
    const entry = this.hass.entities[entityId];
    const platform = typeof entry?.platform === "string" ? entry.platform.toLowerCase() : "";
    return platform;
  }
  _isDefaultAlarmName(value) {
    return typeof value === "string" && /^alarm_\d+$/i.test(value.trim());
  }
  _formatNameForInput(value) {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  }
  _formatAlarmDisplayName(value) {
    const base = this._formatNameForInput(value);
    if (!base) {
      return "";
    }
    return base.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  _formatMediaTitle(value) {
    if (!value) {
      return "";
    }
    const formatted = formatMediaName(value);
    return formatted || value.charAt(0).toUpperCase() + value.slice(1);
  }
  _formatMediaContentTypeLabel(value) {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    const deUnderscored = trimmed.replace(/[_]+/g, " ");
    const normalized = deUnderscored.replace(/\s+/g, " ");
    if (!normalized) {
      return "";
    }
    return normalized.replace(/\b([a-z])/gi, (match) => match.toUpperCase());
  }
  _formatPlatformLabel(value) {
    if (!value) {
      return "";
    }
    return value
      .toString()
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  _lookupAreaName(areaId) {
    if (!areaId || !this.hass?.areas || !Array.isArray(this.hass.areas)) {
      return undefined;
    }
    const match = this.hass.areas.find((area) => area.area_id === areaId);
    return match?.name;
  }
  _getAlarmEntities() {
    if (!this.hass) {
      return [];
    }
    return Object.values(this.hass.states).filter(
      (state) => state?.entity_id && this._isAlarmEntityId(state.entity_id)
    );
  }
  _buildAlarmModels() {
    const alarms = this._getAlarmEntities().map((state) => {
      const attrs = state.attributes || {};
      const scheduled = attrs.scheduled_time ? new Date(attrs.scheduled_time) : null;
      const hours = scheduled ? scheduled.getHours() : 0;
      const minutes = scheduled ? scheduled.getMinutes() : 0;
  const rawName = typeof attrs.name === "string" ? attrs.name.trim() : "";
  const friendlyName = typeof state.attributes?.friendly_name === "string" ? state.attributes.friendly_name.trim() : "";
  const baseName = rawName || friendlyName || "";
  const autoName = rawName ? this._isDefaultAlarmName(rawName) : false;
  const displayName = autoName ? "" : this._formatAlarmDisplayName(baseName);
      const isActive = state.state === "active" || attrs.status === "active";
      const isEnabled = attrs.enabled !== false && state.state !== "disabled";
      const repeat = this._normalizeRepeatValue(attrs.repeat);
      const repeatDays = this._normalizeRepeatDaysList(attrs.repeat_days);
      const repeatLabel = this._formatRepeatLabel(repeat, repeatDays, scheduled);
      const soundDescriptor = attrs.sound_media || attrs.sound_file;
      const scheduledTime = scheduled ? scheduled.toISOString() : null;
      const mediaPlayer = this._normalizeMediaPlayerValue(
        attrs.media_player || attrs.media_player_id || attrs.media_player_entity_id || attrs.media_player_target
      );
      return {
        entity_id: state.entity_id,
        object_id: state.entity_id.split(".")[1],
  name: baseName,
        displayName,
        message: attrs.message || "",
        media_player: mediaPlayer,
        mediaPlayerLabel: this._formatMediaPlayerLabel(mediaPlayer),
        soundLabel: mediaLabelFromDescriptor(soundDescriptor, attrs.sound_file),
        soundTitle:
          typeof soundDescriptor === "object"
            ? this._formatMediaTitle(soundDescriptor.media_content_title || soundDescriptor.title || "")
            : "",
        sound_media_id:
          typeof attrs.sound_media === "object" ? attrs.sound_media.media_content_id : attrs.sound_media || attrs.sound_file,
        sound_media_type:
          typeof attrs.sound_media === "object" ? attrs.sound_media.media_content_type || "" : "",
        repeat,
        repeat_days: repeatDays,
        repeatLabel,
        scheduledTime,
        displayTime: this._formatTime(hours, minutes),
        ampm: this._formatAmPm(hours),
  dateLabel: this._formatDateLabel(repeat, scheduled, attrs.status || state.state, isEnabled),
        status: attrs.status || state.state || "scheduled",
        statusLabel: this._formatStatusLabel(attrs.status || state.state),
        isActive,
        isEnabled,
        activation_entity: attrs.activation_entity,
        spotify_source: attrs.spotify_source || "",
        announce_time: attrs.announce_time,
        announce_name: attrs.announce_name,
      };
    });
    return alarms.sort((a, b) => {
      if (!a.scheduledTime && !b.scheduledTime) return a.entity_id.localeCompare(b.entity_id);
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
    });
  }
  _formatTime(hours, minutes) {
    const h = ((hours + 11) % 12) + 1;
    return `${h}`.padStart(1, "0") + ":" + `${minutes}`.padStart(2, "0");
  }
  _formatAmPm(hours) {
    return hours >= 12 ? "PM" : "AM";
  }
  _formatDateLabel(_repeat, dateObj, status, isEnabled) {
    const normalizedStatus = (status || "").toLowerCase();
    if (normalizedStatus === "expired" || normalizedStatus === "disabled" || !isEnabled) {
      return "Next: Never";
    }
    if (!dateObj) {
      return "";
    }
    const today = new Date();
    const todayStr = today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetStr = dateObj.toDateString();
    if (targetStr === todayStr) {
      return "Next: Today";
    }
    if (targetStr === tomorrow.toDateString()) {
      return "Next: Tomorrow";
    }
    const formatted = dateObj.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return formatted ? `Next: ${formatted}` : "";
  }
  _formatRepeatLabel(repeat, repeatDays, scheduled) {
    switch (repeat) {
      case "daily":
        return "Every day";
      case "weekdays":
        return "Weekdays";
      case "weekends":
        return "Weekends";
      case "custom":
        return repeatDays.length ? repeatDays.map((day) => DAY_LABELS[day] || day).join(" \u00b7 ") : "Custom";
      default:
        return "Once";
    }
  }
  _formatStatusLabel(status) {
    switch ((status || "").toLowerCase()) {
      case "active":
        return "Ringing";
      case "disabled":
        return "Disabled";
      case "snoozed":
        return "Snoozed";
      case "expired":
        return "Expired";
      case "stopped":
        return "Stopped";
      case "scheduled":
      default:
        return "Scheduled";
    }
  }
  _handleKeydown(ev, alarm) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      alarm.isActive ? this._handleActiveShort(alarm) : this._toggleSwitch(alarm);
    } else if (ev.key === "e") {
      ev.preventDefault();
      this._openDialog("edit", alarm);
    }
  }
  _onPointerDown(ev, alarm) {
    if (ev.button !== 0) {
      return;
    }
    ev.preventDefault();
    this._pendingPressAlarm = alarm;
    this._pressTriggered = false;
    this._pressHandle = window.setTimeout(() => {
      this._pressTriggered = true;
      this._pressHandle = null;
      this._handleLongPress(alarm);
    }, this._config.long_press_ms ?? LONG_PRESS_DEFAULT_MS);
  }
  _onPointerUp(ev, alarm) {
    ev.preventDefault();
    if (this._pressHandle) {
      clearTimeout(this._pressHandle);
      this._pressHandle = null;
    }
    if (!this._pressTriggered && this._pendingPressAlarm?.entity_id === alarm.entity_id) {
      this._handleShortPress(alarm);
    }
    this._pendingPressAlarm = null;
  }
  _clearPendingPress = () => {
    if (this._pressHandle) {
      clearTimeout(this._pressHandle);
      this._pressHandle = null;
    }
    this._pendingPressAlarm = null;
  };
  _handleShortPress(alarm) {
    if (alarm.isActive) {
      this._handleActiveShort(alarm);
    } else {
      this._toggleSwitch(alarm);
    }
  }
  _handleLongPress(alarm) {
    if (alarm.isActive) {
      this._handleActiveLong(alarm);
    } else {
      this._openDialog("edit", alarm);
    }
  }
  _handleActiveShort(alarm) {
    const mode = this._getPressMode();
    if (!mode) {
      return;
    }
    if (mode.short === "Stop") {
      this._callStop(alarm);
    } else {
      this._callSnooze(alarm);
    }
  }
  _handleActiveLong(alarm) {
    const mode = this._getPressMode();
    if (!mode) {
      return;
    }
    if (mode.long === "Stop") {
      this._callStop(alarm);
    } else {
      this._callSnooze(alarm);
    }
  }
  async _toggleSwitch(alarm) {
    const entityId = this._alarmSwitchEntityId(alarm.object_id);
    const service = alarm.isEnabled ? "turn_off" : "turn_on";
    try {
      await this.hass.callService("switch", service, { entity_id: entityId });
      this._notify(alarm.isEnabled ? "Alarm disabled" : "Alarm enabled");
    } catch (err) {
      this._notify("Unable to toggle alarm", true);
    }
  }
  async _callStop(alarm) {
    try {
      await this._callIntegrationService("stop_alarm", {
        alarm_id: alarm.entity_id,
      });
      this._notify("Alarm stopped");
    } catch (err) {
      this._notify("Failed to stop alarm", true);
    }
  }
  async _callSnooze(alarm) {
    try {
      const data = { alarm_id: alarm.entity_id };
      const snoozeMinutes = this._getSnoozeMinutes();
      if (snoozeMinutes) {
        data.minutes = snoozeMinutes;
      }
      await this._callIntegrationService("snooze_alarm", data);
      this._notify("Alarm snoozed");
    } catch (err) {
      this._notify("Failed to snooze alarm", true);
    }
  }
  _notify(message, isError = false) {
    fireEvent(this, "hass-notification", {
      message,
      duration: 3000,
      dismissable: true,
      severity: isError ? "error" : "info",
    });
  }
  _integrationDomainFor(service) {
    return INTEGRATION_DOMAIN;
  }
  _callIntegrationService(service, data) {
    const domain = this._integrationDomainFor(service);
    return this.hass.callService(domain, service, data);
  }
  async _callResolveMedia(payload) {
    return this.hass.callWS({
      type: RESOLVE_MEDIA_TYPE,
      ...payload,
    });
  }
  _isAlarmEntityId(entityId) {
    if (!entityId) {
      return false;
    }
    return entityId.startsWith(`${INTEGRATION_DOMAIN}_alarm.`);
  }
  _alarmSwitchEntityId(objectId) {
    const primary = `switch.${INTEGRATION_DOMAIN}_${objectId}`;
    return primary;
  }
  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card {
        padding: 16px;
        position: relative;
        overflow: hidden;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .title {
        font-size: 1.4rem;
        font-weight: 600;
      }
      .legend {
        display: flex;
        gap: 12px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }
      .legend-item {
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 8px;
        border-radius: 999px;
      }
      .icon-button {
        border: none;
        background: transparent;
        color: inherit;
        padding: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
      }
      .icon-button ha-icon {
        width: 20px;
        height: 20px;
      }
      .fab {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: none;
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .fab ha-icon {
        width: 24px;
        height: 24px;
      }
      .settings-warning {
        margin: 0 0 16px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(255, 170, 1, 0.15);
        color: var(--warning-color, #8a6d3b);
        font-size: 0.9rem;
      }
      .settings-warning code {
        font-family: var(--code-font-family, monospace);
        font-size: 0.85em;
      }
      .alarm-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        justify-content: flex-start;
        align-items: stretch;
      }
      .alarm-card {
        box-sizing: border-box;
        border-radius: 20px;
        padding: 16px;
        background: linear-gradient(135deg, rgba(0, 119, 255, 0.14), rgba(0, 119, 255, 0.3));
        color: var(--primary-text-color);
        min-height: 190px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
        gap: 12px;
  flex: 0 1 400px;
  min-width: 360px;
  max-width: 420px;
      }
      .alarm-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      }
      .alarm-card.disabled {
        background: var(--disabled-color, rgba(145, 145, 145, 0.2));
        color: var(--disabled-text-color);
        box-shadow: none;
      }
      .alarm-card.active {
        background: linear-gradient(135deg, rgba(255, 64, 64, 0.9), rgba(255, 0, 0, 0.85));
        color: white;
        animation: pulse 1.8s infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(255, 80, 80, 0.7);
        }
        70% {
          box-shadow: 0 0 0 12px rgba(255, 80, 80, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(255, 80, 80, 0);
        }
      }
      .card-top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
  column-gap: 12px;
      }
      .card-head-left {
        --_time-width: var(--alarm-card-time-width, 74px);
        --_ampm-width: var(--alarm-card-ampm-width, 32px);
        --_status-min: var(--alarm-card-status-min-width, 84px);
        min-width: calc(var(--_time-width) + var(--_ampm-width) + var(--_status-min) + 12px);
      }
      .card-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        justify-self: end;
        align-self: start;
      }
      .skip-button {
        border: none;
        background: rgba(255, 255, 255, 0.25);
        color: inherit;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .skip-button:hover {
        background: rgba(255, 255, 255, 0.35);
      }
      .alarm-card.disabled .skip-button {
        background: rgba(0, 0, 0, 0.1);
      }
      .alarm-card.disabled .skip-button:hover {
        background: rgba(0, 0, 0, 0.15);
      }
      .skip-button ha-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        position: relative;
        top: 1px;
      }
      @media (max-width: 900px) {
        .alarm-card {
          flex: 1 1 100%;
          min-width: 0;
          max-width: none;
        }
        .time-row {
          grid-template-columns: repeat(3, auto);
        }
        .time {
          justify-self: start;
        }
        .ampm {
          justify-self: start;
        }
        .status-chip {
          min-width: 0;
        }
      }
      .time-row {
        display: grid;
        grid-template-columns: var(--alarm-card-time-width, 74px) var(--alarm-card-ampm-width, 32px)
          minmax(var(--alarm-card-status-min-width, 84px), auto);
        column-gap: 6px;
        align-items: center;
      }
      .date-row {
        display: grid;
        grid-template-columns: var(--alarm-card-time-width, 74px) var(--alarm-card-ampm-width, 32px)
          minmax(var(--alarm-card-status-min-width, 84px), auto);
        column-gap: 6px;
        align-items: center;
        margin-top: 4px;
        min-height: 26px;
      }
      .date-row .date {
        grid-column: 1 / span 2;
      }
      .date-row .date.placeholder {
        visibility: hidden;
      }
      .date-row .skip-button {
        grid-column: 3;
        justify-self: flex-start;
      }
      .time {
        font-size: 2.4rem;
        font-weight: 600;
        justify-self: end;
      }
      .ampm {
        font-size: 1rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        justify-self: start;
      }
      .date {
        font-size: 0.9rem;
        opacity: 0.8;
      }
      .status-chip {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.3);
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-width: var(--alarm-card-status-min-width, 96px);
        justify-self: start;
      }
      .status-chip.status-disabled {
        background: rgba(0, 0, 0, 0.05);
        color: var(--disabled-text-color, rgba(0, 0, 0, 0.6));
      }
      .status-chip.status-active {
        background: rgba(255, 255, 255, 0.5);
      }
      .name-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .name {
        font-size: 1rem;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .name.unnamed {
        opacity: 0.75;
        font-style: italic;
      }
      .status {
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 4px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
      }
      .status-disabled {
        background: rgba(0, 0, 0, 0.15);
      }
      .status-active {
        background: rgba(255, 255, 255, 0.35);
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .meta-row {
        display: flex;
        justify-content: flex-start;
        gap: 8px;
        font-size: 0.95rem;
      }
      .label {
        opacity: 0.65;
      }
      .value {
        font-weight: 600;
      }
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--secondary-text-color);
      }
      .empty-icon {
        font-size: 3rem;
        margin-bottom: 8px;
      }
      .empty-icon ha-icon {
        width: 48px;
        height: 48px;
        color: var(--secondary-text-color);
      }
      .empty-title {
        font-size: 1.2rem;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .dialog-backdrop.media-browser-layer {
        z-index: 1105;
      }
      .dialog-panel {
        width: min(560px, 94vw);
        max-height: 90vh;
        background: var(--card-background-color, #fff);
        border-radius: 16px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
      }
      .dialog-panel.media-browser {
        width: 720px;
        max-width: 96vw;
        height: 560px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }
      .media-browser-header {
        align-items: flex-start;
        flex-wrap: nowrap;
        gap: 12px;
      }
      .media-browser-title {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex: 1;
      }
      .dialog-header-actions {
        display: inline-flex;
        align-items: flex-start;
        gap: 8px;
        margin-left: auto;
        flex-shrink: 0;
      }
      .media-mode-toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.05);
      }
      .media-mode-toggle .mode-button {
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .media-mode-toggle .mode-button.active {
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }
      .media-mode-toggle .mode-button[disabled] {
        cursor: default;
        opacity: 0.7;
      }
      @media (max-width: 600px) {
        .dialog-header-actions {
          width: auto;
          justify-content: flex-end;
        }
      }
      .media-browser-subtitle {
        font-size: 0.9rem;
        color: var(--secondary-text-color);
        margin-top: 2px;
        word-break: break-word;
        overflow-wrap: anywhere;
        white-space: normal;
      }
      .media-search-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 4px;
      }
      .media-search-telemetry {
        font-size: 0.875rem;
        color: var(--secondary-text-color, rgba(0, 0, 0, 0.6));
        margin: 0 0 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .media-search-telemetry-sep {
        color: inherit;
        font-size: 0.75rem;
        line-height: 1;
      }
      .media-search-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .media-search-input {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        padding: 8px 12px;
        font-size: 0.95rem;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }
      .media-search-input-row .primary,
      .media-search-input-row .text-button {
        border-radius: 999px;
        padding: 8px 18px;
        font-size: 0.95rem;
        font-weight: 600;
        transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      }
      .media-search-input-row .primary {
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        border: none;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
      }
      .media-search-input-row .primary:hover:not(:disabled) {
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
      }
      .media-search-input-row .primary:disabled {
        opacity: 0.6;
        cursor: default;
        box-shadow: none;
      }
      .media-search-input-row .text-button {
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: rgba(0, 0, 0, 0.04);
        color: var(--primary-text-color);
      }
      .media-search-input-row .text-button:hover:not(:disabled) {
        background: rgba(0, 0, 0, 0.08);
      }
      .media-search-input-row .text-button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .media-search-secondary-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .media-search-option {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
      }
      .media-search-option select,
      .media-search-option input[type="number"] {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 0.9rem;
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }
      .media-search-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
      }
      .media-browser-breadcrumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 8px;
        align-items: center;
        justify-content: flex-start;
      }
      .media-browser-breadcrumbs .crumb {
        border: none;
        background: rgba(0, 0, 0, 0.05);
        padding: 4px 10px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .media-browser-breadcrumbs .crumb[disabled],
      .media-browser-breadcrumbs .crumb.active {
        background: rgba(0, 0, 0, 0.12);
        cursor: default;
      }
      .media-browser-breadcrumbs .crumb.back-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .media-browser-breadcrumbs .crumb.back-button ha-icon.back-icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .crumb-sep {
        align-self: center;
        opacity: 0.5;
      }
      .media-browser-loading,
      .media-browser-empty {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color);
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .media-browser-grid {
        display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        grid-auto-rows: auto;
        justify-content: flex-start;
        justify-items: start;
        align-content: flex-start;
        align-items: flex-start;
        gap: 12px;
        padding: 4px 0;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }
      .media-browser-grid.search-results {
        padding-top: 0;
      }
      .media-item-wrapper {
        position: relative;
        width: 100%;
        max-width: 240px;
      }
      .media-item {
        width: 100%;
        max-width: none;
        border: 1px solid var(--divider-color);
        border-radius: 16px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: var(--card-background-color);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        justify-self: flex-start;
        position: relative;
      }
      .media-item-select-button {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        background: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 55%, white);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        transform: translateY(-6px);
  z-index: 1;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.16);
      }
      .media-item-select-button::before,
      .media-item-select-button::after {
        content: "";
        position: absolute;
  width: 20px;
  height: 3px;
  border-radius: 3px;
  background: #fff;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .media-item-select-button::after {
        transform: translate(-50%, -50%) rotate(90deg);
      }
      .media-item-select-button:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      .media-item-select-button:hover,
      .media-item-select-button:focus-visible {
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
      }
  .media-item-wrapper:hover .media-item-select-button,
  .media-item-wrapper:focus-within .media-item-select-button,
  .media-item:hover + .media-item-select-button,
  .media-item:focus + .media-item-select-button,
  .media-item:focus-visible + .media-item-select-button {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .media-item:hover {
        border-color: var(--primary-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      .media-item.folder {
        background: rgba(0, 0, 0, 0.02);
      }
      .media-thumb {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
      }
      .media-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .media-copy {
        flex: 1;
        overflow: hidden;
      }
      .media-title {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dialog-header h2 {
        margin: 0;
        font-size: 1.3rem;
      }
      .dialog-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 0.9rem;
        color: var(--secondary-text-color);
      }
      .field input,
      .field select {
        background: var(--card-background-color);
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        padding: 8px 10px;
        font-size: 1rem;
      }
      .media-input-group {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .media-input-group input {
        flex: 1;
      }
      .media-preview-controls {
        display: inline-flex;
        gap: 4px;
      }
      .media-preview-button {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.08);
        color: inherit;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .media-preview-button.playing {
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }
      .media-preview-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .media-preview-button.loading ha-icon {
        animation: spin 1s linear infinite;
      }
      .media-picker-button {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .media-picker-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .media-picker-button ha-icon {
        width: 20px;
        height: 20px;
      }
      .preview-error {
        margin-top: 4px;
        font-size: 0.8rem;
        color: var(--error-color);
      }
      .field-hint {
        margin-top: 4px;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }
      .field-hint.warning {
        color: var(--warning-color, #c77800);
      }
      @media (max-width: 520px) {
        .media-browser-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .media-item-wrapper {
          max-width: none;
        }
        .media-item {
          max-width: none;
        }
      }
      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
      .field.span-2 {
        grid-column: span 2;
      }
      .day-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .day-chip {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: transparent;
        cursor: pointer;
      }
      .day-chip.active {
        background: var(--primary-color);
        color: var(--text-primary-color);
        border-color: transparent;
      }
      .switch-row {
        display: flex;
        gap: 20px;
        justify-content: flex-start;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
      }
      .toggle input {
        width: 36px;
        height: 18px;
      }
      .dialog-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .dialog-actions-right {
        display: flex;
        gap: 8px;
      }
      .dialog-actions button,
      .dialog-actions-right button {
        border-radius: 999px;
        border: none;
        padding: 8px 14px;
        cursor: pointer;
      }
      .primary {
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
        font-weight: 600;
      }
      .danger {
        background: rgba(244, 67, 54, 0.1);
        color: #c62828;
      }
      .text-button {
        background: transparent;
        color: inherit;
      }
      .form-error {
        color: var(--error-color);
        background: rgba(244, 67, 54, 0.1);
        border-radius: 12px;
        padding: 8px 12px;
      }
      .danger {
        color: var(--error-color);
      }
    `;
  }
}
class AlarmsCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { state: true },
    };
  }
  setConfig(config) {
    this._config = config;
  }
  render() {
    if (!this._config) {
      this._config = {};
    }
    const settingsEntity = this._getSettingsEntityId();
    const longPressMs = this._config.long_press_ms ?? LONG_PRESS_DEFAULT_MS;
    const legendEnabled = this._config.legend ?? true;
    return html`
      <div class="editor">
        <label>
          <span>Title</span>
          <input type="text" .value=${this._config.title || ""} @input=${(ev) => this._updateConfig("title", ev.target.value)} />
        </label>
        <label>
          <span>Settings entity</span>
          <input type="text" .value=${settingsEntity} @input=${(ev) => this._updateConfig("settings_entity", ev.target.value)} />
        </label>
        <label>
          <span>Long-press duration (ms)</span>
          <input type="number" min="200" max="2000" .value=${longPressMs} @input=${(ev) => this._updateConfig("long_press_ms", Number(ev.target.value))} />
        </label>
        <label class="checkbox">
          <input type="checkbox" .checked=${legendEnabled} @change=${(ev) => this._updateConfig("legend", ev.target.checked)} />
          <span>Show tap/hold legend</span>
        </label>
        <p class="hint">
          Defaults (media player, sounds, snooze minutes, press behavior, activation allow list) are read from
          <code>${settingsEntity}</code>.
        </p>
      </div>
    `;
  }
  _updateConfig(key, value) {
    const newConfig = { ...this._config };
    if (value === "" || value === undefined || Number.isNaN(value)) {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    this._dispatchConfig(newConfig);
  }
  _dispatchConfig(config) {
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }
  static get styles() {
    return css`
      .editor {
        display: grid;
        gap: 12px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      label.checkbox {
        flex-direction: row;
        align-items: center;
      }
      label.checkbox span {
        font-weight: 500;
      }
      input,
      select,
      textarea {
        font: inherit;
        padding: 6px 8px;
        border-radius: 8px;
        border: 1px solid var(--divider-color);
      }
      textarea {
        resize: vertical;
      }
      .hint {
        margin: 4px 0 0;
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }
    `;
  }
}
if (!customElements.get("alarms-card")) {
  customElements.define("alarms-card", AlarmsCard);
}
if (!customElements.get("alarms-card-editor")) {
  customElements.define("alarms-card-editor", AlarmsCardEditor);
}
AlarmsCard.getStubConfig = () => ({
  title: "Alarms",
});
AlarmsCard.getConfigElement = () => {
  return document.createElement("alarms-card-editor");
};







