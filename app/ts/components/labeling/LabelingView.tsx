// The main labeling view.

import { getLabelKey, LabelConfirmationState } from '../../stores/dataStructures/labeling';
import { KeyCode } from '../../stores/dataStructures/types';
import * as stores from '../../stores/stores';
import { startDragging } from '../../stores/utils';
import { TrackView } from '../common/TrackView';
import { LabelType, LabelView } from './LabelView';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';

interface LabelingViewProps {
    viewWidth: number;
    viewHeight: number;
    trackHeight: number;
    trackGap: number;
    timeAxisHeight: number;
}

interface LabelingViewState {
    newLabel_t0?: number;
    newLabel_t1?: number;
}

@observer
export class LabelingView extends React.Component<LabelingViewProps, LabelingViewState> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: LabelingViewProps, context: any) {
        super(props, context);
        this.state = { newLabel_t0: null, newLabel_t1: null };
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.srcElement === document.body) {
            if (event.keyCode === KeyCode.BACKSPACE || event.keyCode === KeyCode.DELETE) {
                if (stores.labelingUiStore.selectedLabels) {
                    stores.labelingUiStore.selectedLabels.forEach(label => {
                        stores.labelingStore.removeLabel(label);
                    });
                }
            }
        }
        if (event.ctrlKey && event.keyCode === 'Z'.charCodeAt(0)) { // Ctrl-Z
            stores.projectStore.labelingUndo();
        }
        if (event.ctrlKey && event.keyCode === 'Y'.charCodeAt(0)) { // Ctrl-Y
            stores.projectStore.labelingRedo();
        }
    }

    private getRelativePosition(event: { clientX: number; clientY: number }): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }

    private onMouseMove(event: React.MouseEvent<Element>): void {
        const x = this.getRelativePosition(event)[0];
        const t = this.getTimeFromX(x);
        stores.projectUiStore.setReferenceTrackTimeCursor(t);
    }

    private getTimeFromX(x: number): number {
        return stores.projectUiStore.referenceTrackPanZoom.getTimeFromX(x);
    }

    private onMouseDownCreateLabel(event: React.MouseEvent<Element>): void {
        const t0 = this.getTimeFromX(this.getRelativePosition(event)[0]);
        let t1 = null;
        if (stores.labelingUiStore.currentClass === null) {
            alert('Please select a class before creating labels.');
            return;
        }

        const isInteractionRect = event.target === this.refs.interactionRect;
        if (isInteractionRect) {
            stores.labelingUiStore.clearLabelSelection();
        }

        startDragging(
            moveEvent => {
                t1 = this.getTimeFromX(this.getRelativePosition(moveEvent)[0]);
                this.setState({
                    newLabel_t0: Math.min(t0, t1),
                    newLabel_t1: Math.max(t0, t1)
                });
            },
            upEvent => {
                this.setState({
                    newLabel_t0: null,
                    newLabel_t1: null
                });
                if (t0 !== t1 && t1) {
                    if (stores.labelingUiStore.currentClass) {
                        const newLabel = {
                            timestampStart: Math.min(t0, t1),
                            timestampEnd: Math.max(t0, t1),
                            className: stores.labelingUiStore.currentClass,
                            state: LabelConfirmationState.MANUAL
                        };
                        stores.labelingStore.addLabel(newLabel);
                        stores.labelingUiStore.selectLabel(newLabel);
                    }
                } else {
                    if (isInteractionRect && (upEvent as MouseEvent).shiftKey) {
                        const labels = stores.labelingStore.getLabelsInRange(
                            {
                                timestampStart: stores.projectUiStore.referenceTrackTimeRange.timestampStart,
                                timestampEnd: t0
                            });
                        if (labels.length > 0) {
                            // Get the one with largest timestampEnd.
                            labels.sort((a, b) => a.timestampEnd - b.timestampEnd);
                            const lastLabel = labels[labels.length - 1];
                            if (lastLabel.timestampEnd < t0) {  // add if t0 is after the last label.
                                const newLabel = {
                                    timestampStart: lastLabel.timestampEnd,
                                    timestampEnd: t0,
                                    className: stores.labelingUiStore.currentClass,
                                    state: LabelConfirmationState.UNCONFIRMED
                                };
                                stores.labelingStore.addLabel(newLabel);
                                stores.labelingUiStore.selectLabel(newLabel);
                            }
                        }
                    }
                }
            }
        );
    }

    private onMouseWheel(event: React.WheelEvent<Element>): void {
        // Decide the zooming factor.
        stores.projectUiStore.zoomReferenceTrack(event.deltaY / 1000, 'cursor');
    }

    public render(): JSX.Element {
        // Compute layout
        // Confirmed label band area
        const labelBandHeight = 20;

        // Labels/detailed view sensors area
        const labelAreaY0 = this.props.timeAxisHeight + labelBandHeight;
        const labelAreaY1 = this.props.viewHeight;

        // New label height (should extend over labelBandHeight)
        const newLabelY0 = this.props.timeAxisHeight;
        const newLabelY1 = labelAreaY1;

        const start = stores.projectUiStore.referenceTrackPanZoom.rangeStart;
        const pps = stores.projectUiStore.referenceTrackPanZoom.pixelsPerSecond;
        // The time scale.
        const scale = d3.scaleLinear()
            .domain([start, start + this.props.viewWidth / pps])
            .range([0, this.props.viewWidth]);

        // New label range
        let newLabelRange = null;
        if (this.state.newLabel_t0 && this.state.newLabel_t1) {
            newLabelRange = (
                <g className='new-label'>
                    <rect
                        x={scale(this.state.newLabel_t0)} y={newLabelY0}
                        width={scale(this.state.newLabel_t1) - scale(this.state.newLabel_t0)}
                        height={newLabelY1 - newLabelY0}
                    />
                </g>
            );
        }

        // view for suggestion progress bar
        let suggestionProgress = null;
        if (stores.labelingUiStore.isSuggesting) {
            suggestionProgress = (
                <g>
                    <rect
                        x={scale(stores.labelingUiStore.suggestionTimestampStart)}
                        y={this.props.timeAxisHeight - 3}
                        width={scale(stores.labelingUiStore.suggestionTimestampCompleted) -
                            scale(stores.labelingUiStore.suggestionTimestampStart)}
                        height={3}
                        style={{ fill: '#AAA' }}
                    />
                </g>
            );
        }

        // band to show confirmed labels
        const confirmedLabelBand = (
            <rect
                x={0} y={this.props.timeAxisHeight}
                width={this.props.viewWidth}
                height={labelBandHeight}
                style={{ stroke: 'none', fill: '#EEE', cursor: 'crosshair' }}
            />
        );

        // view for holding labels
        const labels = stores.labelingUiStore
            .getLabelsInRange(stores.projectUiStore.referenceTrackPanZoom
                .getTimeRangeToX(this.props.viewWidth));
        const refPanZoom = stores.projectUiStore.referenceTrackPanZoom;
        const startX = refPanZoom.pixelsPerSecond * refPanZoom.rangeStart;
        const labelsView = (
            <g className='labels' transform={`translate(0, ${labelAreaY0})`}>
                <g transform={`translate(${-startX},0)`}>
                    {labels.map(label =>
                        <LabelView
                            key={getLabelKey(label)}
                            label={label}
                            pixelsPerSecond={stores.projectUiStore.referenceTrackPanZoom.pixelsPerSecond}
                            height={labelAreaY1 - labelAreaY0}
                            classColormap={stores.labelingStore.classColormap}
                            labelType={LabelType.Detailed}
                        />
                    )}
                </g>
            </g>
        );

        const signalsViewMode = stores.labelingUiStore.signalsViewMode;
        return (
            <g className='labeling-detailed-view'>
                <g
                    onMouseMove={event => this.onMouseMove(event)}
                    onWheel={event => this.onMouseWheel(event)}
                    onMouseDown={event => this.onMouseDownCreateLabel(event)}
                >

                    <rect ref='interactionRect'
                        x={0} y={labelAreaY0}
                        width={this.props.viewWidth} height={labelAreaY1 - labelAreaY0}
                        style={{ fill: 'none', stroke: 'none', pointerEvents: 'all', cursor: 'crosshair' }}
                    />

                    {
                        stores.projectStore.tracks.map((track, index) => (
                            <g key={track.id}
                                transform={`translate(0, ${labelAreaY0 + this.props.trackGap * index})`}>
                                <TrackView
                                    track={track}
                                    zoomTransform={stores.projectUiStore.referenceTrackPanZoom}
                                    viewHeight={this.props.trackHeight}
                                    viewWidth={this.props.viewWidth}
                                    useMipmap={true}
                                    signalsViewMode={signalsViewMode}
                                />
                            </g>
                        ))
                    }

                    {suggestionProgress}
                    {confirmedLabelBand}
                    {labelsView}
                    {newLabelRange}
                </g>
            </g>
        );
    }
}
