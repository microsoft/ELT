// LabelsRangePlot: Render labels efficiently.

import {getUniqueIDForObject} from '../../stores/utils';
import {Label, LabelConfirmationState} from '../../stores/dataStructures/labeling';
import * as stores from '../../stores/stores';
import {EventListenerComponent} from '../common/EventListenerComponent';
import {LabelKind, LabelPlot} from './LabelPlot';
import * as React from 'react';
import {observer} from 'mobx-react';


export interface LabelsRangePlotProps {
    rangeStart: number;
    pixelsPerSecond: number;
    plotWidth: number;
    plotHeight: number;
    highlightLeastConfidentSuggestions: boolean;
    labelKind: LabelKind;
}


interface LabelsRangePlotState {
    labels: Label[];
    classColormap: { [name: string]: string };
    threeLeastConfidentSuggestions: Label[];
}

@observer
export class LabelsRangePlot extends React.Component<LabelsRangePlotProps, LabelsRangePlotState> {

    constructor(props: LabelsRangePlotProps, context: any) {
        super(props, context);
        this.state = this.computeState(props);
        this.updateState = this.updateState.bind(this);
    }

    public shouldComponentUpdate(nextProps: LabelsRangePlotProps, nextState: LabelsRangePlotState): boolean {
        return this.props.rangeStart !== nextProps.rangeStart ||
            this.props.pixelsPerSecond !== nextProps.pixelsPerSecond ||
            this.props.plotWidth !== nextProps.plotWidth ||
            this.props.plotHeight !== nextProps.plotHeight ||
            this.state.classColormap !== nextState.classColormap ||
            this.state.labels.length !== nextState.labels.length ||
            !this.state.labels.every((label, i) => label === nextState.labels[i]) ||
            !(this.state.threeLeastConfidentSuggestions === this.state.threeLeastConfidentSuggestions ||
                this.state.threeLeastConfidentSuggestions.every((label, i) => label === nextState.threeLeastConfidentSuggestions[i]));
    }

    protected updateState(): void {
        this.setState(this.computeState(this.props));
    }

    public componentWillReceiveProps(newProps: LabelsRangePlotProps): void {
        this.setState(this.computeState(newProps));
    }

    public computeState(props: LabelsRangePlotProps): LabelsRangePlotState {
        const labels = stores.labelingUiStore.getLabelsInRange(
            props.rangeStart, props.rangeStart + props.plotWidth / props.pixelsPerSecond);

        let threeLeastConfidentSuggestions: Label[] = null;
        if (props.highlightLeastConfidentSuggestions) {
            threeLeastConfidentSuggestions = stores.labelingUiStore.suggestionLogic.calculateHighlightedLabels({
                suggestionsInView: labels.filter((l) => l.state === LabelConfirmationState.UNCONFIRMED)
            });
        }

        return {
            labels: labels,
            classColormap: stores.labelingStore.classColormap,
            threeLeastConfidentSuggestions: threeLeastConfidentSuggestions
        };
    }

    public render(): JSX.Element {
        return (
            <g transform={`translate(${-this.props.pixelsPerSecond * this.props.rangeStart},0)`}>
                {this.state.labels.map((label, i) =>
                    <LabelPlot
                        key={`label-${getUniqueIDForObject(label)}`}
                        label={label}
                        pixelsPerSecond={this.props.pixelsPerSecond}
                        height={this.props.plotHeight}
                        classColormap={this.state.classColormap}
                        labelKind={this.props.labelKind}
                        isLeastConfidentSuggestion={this.state.threeLeastConfidentSuggestions ?
                            this.state.threeLeastConfidentSuggestions.indexOf(label) >= 0 : false}
                        />
                ) }
            </g>
        );
    }
}
