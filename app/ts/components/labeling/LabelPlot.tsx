import {startDragging} from '../../common/common';
import {Label, LabelConfirmationState} from '../../common/labeling';
import * as stores from '../../stores/stores';
import {SVGGlyphiconButton} from '../svgcontrols/buttons';
import * as d3 from 'd3';
import * as React from 'react';


// LabelPlot: Renders a single label.


export enum LabelKind { Detailed, Overview }


export interface LabelPlotProps {
    // The label to render.
    label: Label;
    // Zooming factor.
    pixelsPerSecond: number;
    // Height of the rendered label.
    height: number;
    isLeastConfidentSuggestion: boolean;
    classColormap: { [name: string]: string };
    labelKind: LabelKind;
}


interface LabelPlotState {
    timestampStart: number;
    timestampEnd: number;
    className: string;
    state: LabelConfirmationState;
    hovered: boolean;
    selected: boolean;
    suggestionConfidence: number;
}


export class LabelPlot extends React.Component<LabelPlotProps, LabelPlotState> {
    constructor(props: LabelPlotProps, context: any) {
        super(props, context);

        this.state = {
            timestampStart: this.props.label.timestampStart,
            timestampEnd: this.props.label.timestampEnd,
            className: this.props.label.className,
            state: this.props.label.state,
            hovered: stores.labelingUiStore.isLabelHovered(this.props.label),
            selected: stores.labelingUiStore.isLabelSelected(this.props.label),
            suggestionConfidence: this.props.label.suggestionConfidence !== undefined && this.props.label.suggestionConfidence !== null ?
                this.props.label.suggestionConfidence : null
        };

        this.update = this.update.bind(this);
    }

    public shouldComponentUpdate(nextProps: LabelPlotProps, nextState: LabelPlotState): boolean {
        return this.props.label !== nextProps.label ||
            this.props.pixelsPerSecond !== nextProps.pixelsPerSecond ||
            this.props.height !== nextProps.height ||
            this.props.classColormap !== nextProps.classColormap ||
            this.props.isLeastConfidentSuggestion !== nextProps.isLeastConfidentSuggestion ||
            nextState.timestampStart !== this.state.timestampStart ||
            nextState.timestampEnd !== this.state.timestampEnd ||
            nextState.className !== this.state.className ||
            nextState.state !== this.state.state ||
            nextState.hovered !== this.state.hovered ||
            nextState.selected !== this.state.selected;
    }

    private update(): void {
        this.setState({
            timestampStart: this.props.label.timestampStart,
            timestampEnd: this.props.label.timestampEnd,
            className: this.props.label.className,
            state: this.props.label.state,
            hovered: stores.labelingUiStore.isLabelHovered(this.props.label),
            selected: stores.labelingUiStore.isLabelSelected(this.props.label),
            suggestionConfidence: this.props.label.suggestionConfidence !== undefined && this.props.label.suggestionConfidence !== null ?
                this.props.label.suggestionConfidence : null
        });
    }

    public componentDidMount(): void {
        stores.labelingStore.labelChanged.on(this.props.label, this.update);
        stores.labelingUiStore.labelHoveringChanged.on(this.props.label, this.update);
        stores.labelingUiStore.labelSelectionChanged.on(this.props.label, this.update);
    }

    public componentWillUnmount(): void {
        stores.labelingStore.labelChanged.off(this.props.label, this.update);
        stores.labelingUiStore.labelHoveringChanged.off(this.props.label, this.update);
        stores.labelingUiStore.labelSelectionChanged.off(this.props.label, this.update);
    }


        private onDragLabel(labelPlot: LabelPlot, event: React.MouseEvent, mode: string): void {
        if (event.shiftKey || event.button === 2) { return; }

        event.stopPropagation();
        const eventTarget = event.target;
        const label = labelPlot.props.label;
        const t0 = labelPlot.state.timestampStart;
        const t1 = labelPlot.state.timestampEnd;
        let isSelected = false;

        startDragging(
            moveEvent => {
                const tNew = stores.alignmentLabelingUiStore.referenceViewTimeCursor;
                if (mode === 'start') {
                    if (!isSelected) {
                        stores.labelingUiStore.selectLabel(label);
                        isSelected = true;
                    }
                    const newTimestampStart = Math.min(t1, tNew);
                    const newTimestampEnd = Math.max(t1, tNew);
                    let newState = label.state;
                    if (label.state === LabelConfirmationState.UNCONFIRMED) {
                        newState = LabelConfirmationState.CONFIRMED_START;
                    } else if (label.state === LabelConfirmationState.CONFIRMED_END) {
                        newState = LabelConfirmationState.CONFIRMED_BOTH;
                    }
                    stores.labelingUiStore.updateLabel(label, {
                        timestampStart: newTimestampStart,
                        timestampEnd: newTimestampEnd,
                        state: newState
                    });
                }
                if (mode === 'end') {
                    if (!isSelected) {
                        stores.labelingUiStore.selectLabel(label);
                        isSelected = true;
                    }
                    const newTimestampStart = Math.min(t0, tNew);
                    const newTimestampEnd = Math.max(t0, tNew);
                    let newState = label.state;
                    if (label.state === LabelConfirmationState.UNCONFIRMED) {
                        newState = LabelConfirmationState.CONFIRMED_END;
                    } else if (label.state === LabelConfirmationState.CONFIRMED_START) {
                        newState = LabelConfirmationState.CONFIRMED_BOTH;
                    }
                    stores.labelingUiStore.updateLabel(label, {
                        timestampStart: newTimestampStart,
                        timestampEnd: newTimestampEnd,
                        state: newState
                    });
                }
                if (mode === 'both') {
                    // label.timestampStart = t0 + tNew - tDown;
                    // label.timestampEnd = t1 + tNew - tDown;
                    // labelingUiStore.updateLabel(label);
                }
            },
            upEvent => {
                if (mode === 'both' && upEvent.target === eventTarget && !isSelected) {
                    stores.labelingUiStore.selectLabel(label);
                    isSelected = true;
                }
            }
        );
    }

    private onMouseEnterLabel(labelPlot: LabelPlot, event: React.MouseEvent): void {
        stores.labelingUiStore.hoverLabel(labelPlot.props.label);
    }

    private onMouseLeaveLabel(labelPlot: LabelPlot, event: React.MouseEvent): void {
        stores.labelingUiStore.hoverLabel(null);
    }

    private isLabelConfirmed(state: LabelPlotState): boolean {
        return state.state === LabelConfirmationState.MANUAL || state.state === LabelConfirmationState.CONFIRMED_BOTH;
    }

    private getSuggestionConfidenceOrOne(state: LabelPlotState): number {
        if (state.suggestionConfidence !== null && state.state !== LabelConfirmationState.CONFIRMED_BOTH) {
            return state.suggestionConfidence;
        } else {
            return 1;
        }
    }

    private renderLabelOverview(labelPlot: LabelPlot, props: LabelPlotProps, state: LabelPlotState): JSX.Element {
        const label = state;
        const x1 = label.timestampStart * props.pixelsPerSecond;
        const x2 = label.timestampEnd * props.pixelsPerSecond;
        let topBand = null;
        if (this.isLabelConfirmed(state)) {
            topBand = (
                <rect
                    className='top'
                    x={x1}
                    y={0}
                    width={x2 - x1}
                    height={5}
                    style={{ fill: props.classColormap[label.className] }}
                    />
            );
        }
        return (
            <g>
                {topBand}
                <rect
                    x={x1}
                    y={5}
                    width={x2 - x1}
                    height={props.height - 5}
                    style={{ fill: props.classColormap[label.className], opacity: 0.1 + this.getSuggestionConfidenceOrOne(state) * 0.3 }}
                    />
            </g>
        );
    }

    private renderLabelDetailed(labelPlot: LabelPlot, props: LabelPlotProps, state: LabelPlotState): JSX.Element {
        const label = state;
        const x1 = label.timestampStart * props.pixelsPerSecond;
        const x2 = label.timestampEnd * props.pixelsPerSecond;
        const additionalClasses = [];

        if (state.selected) {
            additionalClasses.push('selected');
        }
        if (state.hovered) {
            additionalClasses.push('hovered');
        }

        let uiElements = null;
        if (state.hovered) {
            uiElements = (
                <g className='label-controls' transform={`translate(${x1}, 0)`}>
                    <SVGGlyphiconButton
                        x={Math.max(0, x2 - x1 - 24) } y={0} width={24} height={24} text='remove'
                        onMouseDown = { (e) => {
                            e.stopPropagation();
                            stores.labelingUiStore.removeLabel(props.label);
                        } }
                        />
                </g>
            );
        }

        let topBand = null;
        if (this.isLabelConfirmed(state)) {
            topBand = (
                <rect
                    className='top'
                    x={x1}
                    y={-20}
                    width={x2 - x1}
                    height={20}
                    style={ { fill: props.classColormap[label.className] } }
                    />
            );
        }

        const borderColor = state.hovered || state.selected ?
            d3.rgb(props.classColormap[label.className]).darker(1) :
            props.classColormap[label.className];
        const lineY0 = topBand ? -20 : 0;

        let highlightMarker = null;
        if (props.isLeastConfidentSuggestion) {
            highlightMarker = (<text x={x1 + 3} y={14} style={{ fill: 'black', fontSize: 12 }}>?</text>);
        }

        return (
            <g className={`label-container ${additionalClasses.join(' ')}`}
                onMouseEnter = { event => this.onMouseEnterLabel(labelPlot, event) }
                onMouseLeave = { event => this.onMouseLeaveLabel(labelPlot, event) }
                >
                {topBand}
                <rect
                    className='range'
                    x={x1}
                    y={0}
                    width={x2 - x1}
                    height={props.height}
                    style={ { fill: props.classColormap[label.className], opacity: 0.1 + this.getSuggestionConfidenceOrOne(state) * 0.3 } }
                    />
                <line
                    className='border'
                    x1={x1} x2={x1} y1={lineY0} y2={props.height}
                    style={ { stroke: borderColor } }
                    />
                <line
                    className='border'
                    x1={x2} x2={x2} y1={lineY0} y2={props.height}
                    style={ { stroke: borderColor } }
                    />
                {highlightMarker}
                <rect
                    className='middle-handler'
                    x={x1}
                    y={0}
                    width={x2 - x1}
                    height={props.height}
                    onMouseDown={ event => this.onDragLabel(labelPlot, event, 'both') }
                    />
                <rect
                    className='handler'
                    x={x1 - 3} width={6} y={0} height={props.height}
                    onMouseDown={ event => this.onDragLabel(labelPlot, event, 'start') }
                    />
                <rect
                    className='handler'
                    x={x2 - 3} width={6} y={0} height={props.height}
                    onMouseDown={ event => this.onDragLabel(labelPlot, event, 'end') }
                    />
                {uiElements}
            </g>
        );
    }


    public render(): JSX.Element {
        if (this.state.state === LabelConfirmationState.REJECTED) {
            return <g></g>;
        } else {
            switch (this.props.labelKind) {
                case LabelKind.Detailed: return this.renderLabelDetailed(this, this.props, this.state);
                case LabelKind.Overview: return this.renderLabelOverview(this, this.props, this.state);
                default: throw 'missing case';
            }
        }
    }
}
