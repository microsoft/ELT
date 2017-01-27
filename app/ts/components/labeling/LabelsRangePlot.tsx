// LabelsRangePlot: Render labels efficiently.

import { Label, LabelConfirmationState } from '../../stores/dataStructures/labeling';
import * as stores from '../../stores/stores';
import { getUniqueIDForObject } from '../../stores/utils';
import { LabelKind, LabelPlot } from './LabelPlot';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface LabelsRangePlotProps {
    rangeStart: number;
    pixelsPerSecond: number;
    plotWidth: number;
    plotHeight: number;
    highlightLeastConfidentSuggestions: boolean;
    labelKind: LabelKind;
}


@observer
export class LabelsRangePlot extends React.Component<LabelsRangePlotProps, {}> {

    public render(): JSX.Element {
        const props = this.props;
        const labels = stores.labelingUiStore.getLabelsInRange(
            props.rangeStart, props.rangeStart + props.plotWidth / props.pixelsPerSecond);

        let threeLeastConfidentSuggestions: Label[] = null;
        if (props.highlightLeastConfidentSuggestions) {
            threeLeastConfidentSuggestions = stores.labelingUiStore.suggestionLogic.calculateHighlightedLabels({
                suggestionsInView: labels.filter(l => l.state === LabelConfirmationState.UNCONFIRMED)
            });
        }

        return (
            <g transform={`translate(${-this.props.pixelsPerSecond * this.props.rangeStart},0)`}>
                {labels.map(label =>
                    <LabelPlot
                        key={`label-${getUniqueIDForObject(label)}`}
                        label={label}
                        pixelsPerSecond={this.props.pixelsPerSecond}
                        height={this.props.plotHeight}
                        classColormap={stores.labelingStore.classColormap}
                        labelKind={this.props.labelKind}
                        isLeastConfidentSuggestion={threeLeastConfidentSuggestions ?
                            threeLeastConfidentSuggestions.indexOf(label) >= 0 : false}
                        />
                )}
            </g>
        );
    }
}
