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
    labelType: LabelType;
}

@observer
export class LabelsRangePlot extends React.Component<LabelsRangePlotProps, {}> {

    public render(): JSX.Element {
        const props = this.props;
        const labels = stores.labelingUiStore.getLabelsInRange(props.panZoom.getTimeRangeToX(props.plotWidth));
       
        return (
            <g transform={`translate(${-this.props.panZoom.pixelsPerSecond * this.props.panZoom.rangeStart},0)`}>
                {labels.map(label =>
                    <LabelView
                        key={`label-${getUniqueIDForObject(label)}`}
                        label={label}
                        pixelsPerSecond={this.props.panZoom.pixelsPerSecond}
                        height={this.props.plotHeight}
                        classColormap={stores.labelingStore.classColormap}
                        labelType={this.props.labelType}
                    />
                )}
            </g>
        );
    }
}
