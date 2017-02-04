// LabelsRangePlot: Render labels efficiently.

import { Label, LabelConfirmationState } from '../../stores/dataStructures/labeling';
import { PanZoomParameters } from '../../stores/dataStructures/PanZoomParameters';
import * as stores from '../../stores/stores';
import { getUniqueIDForObject } from '../../stores/utils';
import { LabelType, LabelView } from './LabelView';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface LabelsRangePlotProps {
    panZoom: PanZoomParameters;
    plotWidth: number;
    plotHeight: number;
    highlightLeastConfidentSuggestions: boolean;
    labelKind: LabelType;
}


@observer
export class LabelsRangePlot extends React.Component<LabelsRangePlotProps, {}> {

    public render(): JSX.Element {
        const props = this.props;
        const labels = stores.labelingUiStore.getLabelsInRange(props.panZoom.getTimeRangeToX(props.plotWidth));
        let threeLeastConfidentSuggestions: Label[] = null;
        if (props.highlightLeastConfidentSuggestions) {
            threeLeastConfidentSuggestions = stores.labelingUiStore.suggestionLogic.calculateHighlightedLabels({
                suggestionsInView: labels.filter(l => l.state === LabelConfirmationState.UNCONFIRMED)
            });
        }

        return (
            <g transform={`translate(${-this.props.panZoom.pixelsPerSecond * this.props.panZoom.rangeStart},0)`}>
                {labels.map(label =>
                    <LabelView
                        key={`label-${getUniqueIDForObject(label)}`}
                        label={label}
                        pixelsPerSecond={this.props.panZoom.pixelsPerSecond}
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
