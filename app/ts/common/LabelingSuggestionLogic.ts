// Declares logics to run suggestions.

import {Dataset} from './dataset';
import {Label, TimeRange} from './labeling';
import {TimeRangeIndex} from './timeRangeIndex';
import * as d3 from 'd3';




export enum LabelingSuggestionLogicType {
    FORWARD,            // Suggest from the last label only, on select suggestion, keep previous ones.
    FORWARD_CONFIRM,    // Forward, on select suggestion, confirm all before.
    FORWARD_REJECT,     // Forward, on select suggestion, reject all before.
    CURRENT_VIEW        // Suggest from the current view, towards the end of the dataset.
}

export abstract class LabelingSuggestionLogic {
    public abstract getType(): LabelingSuggestionLogicType;
    public abstract getDescription(): string;

    // If the event in info happened, should we recompute the suggestions?
    public abstract shouldTriggerSuggestionUpdate(info: {
        didViewportChange: boolean
    }): boolean;

    // On what time range should we compute suggestions?
    public abstract calculateSuggestionRange(info: {
        dataset: Dataset,
        labels: Label[],
        detailedViewRange: TimeRange
    }): TimeRange;

    // During the suggestion progress, how should we refresh existing suggestions.
    // By default, we update matching suggestions.
    public abstract refreshSuggestions(info: {
        suggestionProgress: {
            timestampStart: number,
            timestampEnd: number,
            timestampCompleted: number
        },
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            deleteLabels: Label[]
        };

    // When a (or a set of) label has been confirmed, which suggestions should we update or delete.
    public abstract onConfirmLabels(info: {
        labelsConfirmed: Label[],
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            confirmLabels: Label[],
            rejectLabels: Label[],
            deleteLabels: Label[]
        };

    // What labels should be highlighted (to attract the user's attention).
    public abstract calculateHighlightedLabels(info: {
        suggestionsInView: Label[]
    }): Label[];
}

class LabelingSuggestionLogicCurrentView {
    public getType(): LabelingSuggestionLogicType {
        return LabelingSuggestionLogicType.CURRENT_VIEW;
    }
    public getDescription(): string {
        return 'Suggest in the current view and two views forward.';
    }
    // If the event in info happened, should we recompute the suggestions?
    public shouldTriggerSuggestionUpdate(info: {
        didViewportChange: boolean
    }): boolean {
        return info.didViewportChange;
    }

    // On what time range should we compute suggestions?
    public calculateSuggestionRange(info: {
        dataset: Dataset,
        labels: Label[],
        detailedViewRange: TimeRange
    }): TimeRange {
        const start = info.detailedViewRange.timestampStart;
        const end = info.detailedViewRange.timestampEnd +
            (info.detailedViewRange.timestampEnd - info.detailedViewRange.timestampStart) * 2;
        return {
            timestampStart: start,
            timestampEnd: end
        };
    }

    // During the suggestion progress, how should we refresh existing suggestions.
    // By default, we update matching suggestions.
    public refreshSuggestions(info: {
        suggestionProgress: {
            timestampStart: number,
            timestampEnd: number,
            timestampCompleted: number
        },
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            deleteLabels: Label[]
        } {
        return {
            deleteLabels: info.currentSuggestions.getRangesInRange(-1e10, info.suggestionProgress.timestampCompleted)
        };
    }

    // When a (or a set of) label has been confirmed, which suggestions should we update or delete.
    public onConfirmLabels(info: {
        labelsConfirmed: Label[],
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            confirmLabels: Label[],
            rejectLabels: Label[],
            deleteLabels: Label[]
        } {
        return {
            confirmLabels: [],
            rejectLabels: [],
            deleteLabels: []
        };
    }

    public calculateHighlightedLabels(info: {
        suggestionsInView: Label[]
    }): Label[] {
        const candidates = info.suggestionsInView.slice();
        candidates.sort((a, b) => a.suggestionConfidence - b.suggestionConfidence);
        return candidates.slice(0, 3);
    }
}

class LabelingSuggestionLogicForward {
    public getType(): LabelingSuggestionLogicType {
        return LabelingSuggestionLogicType.FORWARD;
    }

    public getDescription(): string {
        return 'Suggest forward from the last confirmed label towards the end of the dataset.';
    }
    // If the event in info happened, should we recompute the suggestions?
    public shouldTriggerSuggestionUpdate(info: {
        didViewportChange: boolean
    }): boolean {
        return false;
    }

    // On what time range should we compute suggestions?
    public calculateSuggestionRange(info: {
        dataset: Dataset,
        labels: Label[],
        detailedViewRange: TimeRange
    }): TimeRange {
        return {
            timestampStart: d3.max(info.labels, (l) => l.timestampEnd - (l.timestampEnd - l.timestampStart) * 0.1),
            timestampEnd: info.dataset.timestampEnd
        };
    }

    // During the suggestion progress, how should we refresh existing suggestions.
    // By default, we update matching suggestions.
    public refreshSuggestions(info: {
        suggestionProgress: {
            timestampStart: number,
            timestampEnd: number,
            timestampCompleted: number
        },
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            deleteLabels: Label[]
        } {
        return {
            deleteLabels: info.currentSuggestions.getRangesInRange(
                info.suggestionProgress.timestampStart, info.suggestionProgress.timestampCompleted)
        };
    }

    // When a (or a set of) label has been confirmed, which suggestions should we update or delete.
    public onConfirmLabels(info: {
        labelsConfirmed: Label[],
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            confirmLabels: Label[],
            rejectLabels: Label[],
            deleteLabels: Label[]
        } {
        return {
            confirmLabels: [],
            rejectLabels: [],
            deleteLabels: []
        };
    }

    public calculateHighlightedLabels(info: {
        suggestionsInView: Label[]
    }): Label[] { return []; }
}

class LabelingSuggestionLogicForwardConfirm extends LabelingSuggestionLogicForward {
    public getType(): LabelingSuggestionLogicType {
        return LabelingSuggestionLogicType.FORWARD_CONFIRM;
    }
    public getDescription(): string {
        return 'Suggest forward from the last confirmed label towards the end of the dataset. ' +
            'Once a label has been confirmed, confirm suggestions before it.';
    }
    public onConfirmLabels(info: {
        labelsConfirmed: Label[],
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            confirmLabels: Label[],
            rejectLabels: Label[],
            deleteLabels: Label[]
        } {
        return {
            confirmLabels: info.currentSuggestions.getRangesInRange(-1e10, d3.min(info.labelsConfirmed, (l) => l.timestampStart)),
            rejectLabels: [],
            deleteLabels: []
        };
    }
}

class LabelingSuggestionLogicForwardReject extends LabelingSuggestionLogicForward {
    public getType(): LabelingSuggestionLogicType {
        return LabelingSuggestionLogicType.FORWARD_REJECT;
    }
    public getDescription(): string {
        return 'Suggest forward from the last confirmed label towards the end of the dataset. ' +
            'Once a label has been confirmed, delete suggestions before it.';
    }
    public onConfirmLabels(info: {
        labelsConfirmed: Label[],
        currentSuggestions: TimeRangeIndex<Label>
    }): {
            confirmLabels: Label[],
            rejectLabels: Label[],
            deleteLabels: Label[]
        } {
        return {
            confirmLabels: [],
            rejectLabels: [],
            deleteLabels: info.currentSuggestions.getRangesInRange(-1e10, d3.min(info.labelsConfirmed, (l) => l.timestampStart))
        };
    };
}

export function getLabelingSuggestionLogic(logicType: LabelingSuggestionLogicType): LabelingSuggestionLogic {
    switch (logicType) {
        case LabelingSuggestionLogicType.CURRENT_VIEW:
            return new LabelingSuggestionLogicCurrentView();
        case LabelingSuggestionLogicType.FORWARD:
            return new LabelingSuggestionLogicForward();
        case LabelingSuggestionLogicType.FORWARD_CONFIRM:
            return new LabelingSuggestionLogicForwardConfirm();
        case LabelingSuggestionLogicType.FORWARD_REJECT:
            return new LabelingSuggestionLogicForwardReject();
        default:
            return new LabelingSuggestionLogicCurrentView();
    }
}
