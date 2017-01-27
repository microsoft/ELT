// TimeRange and labels.

export interface TimeRange {
    timestampStart: number;
    timestampEnd: number;
}


export interface Label extends TimeRange {
    className: string;              // The class of the label.
    suggestionGeneration?: number;  // The generation of the suggestion.
    suggestionConfidence?: number;  // The confidence value of the suggestion, range from 0 to 1.
}

export interface PartialLabel {
    timestampStart?: number;
    timestampEnd?: number;
    className?: string;
    suggestionGeneration?: number;
    suggestionConfidence?: number;
}
