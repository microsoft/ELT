// TimeRange and labels.

export interface TimeRange {
    timestampStart: number;
    timestampEnd: number;
}

export enum LabelConfirmationState {
    MANUAL           = 1,     // Manually labeled.
    UNCONFIRMED      = 2,     // Suggested, but not confirmed.
    CONFIRMED_START  = 3,     // Starting point confirmed.
    CONFIRMED_END    = 4,     // Ending point confirmed.
    CONFIRMED_BOTH   = 5,     // Both starting and ending point confirmed.
    REJECTED         = 10     // Suggestion was rejected.
}

export interface Label extends TimeRange {
    className: string;              // The class of the label.
    state: LabelConfirmationState;  // The confirmation state of the label.
    suggestionGeneration?: number;  // The generation of the suggestion.
    suggestionConfidence?: number;  // The confidence value of the suggestion, range from 0 to 1.
}

export function getLabelKey(label: Label): string {
    return `{label.className}-${label.state}-${label.timestampStart}-${label.timestampEnd}`;
}

export interface PartialLabel {
    timestampStart?: number;
    timestampEnd?: number;
    className?: string;
    state?: LabelConfirmationState;
    suggestionGeneration?: number;
    suggestionConfidence?: number;
}

// UI common.
export enum SignalsViewMode {
    TIMESERIES,
    AUTOCORRELOGRAM,
    COMBINED
}
