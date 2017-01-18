// Alignment main view.
// - Including tracks (but not the reference track), markers and correspondences.
// - Handles alignment keyboard events.

import * as actions from '../../actions/Actions';
import { AlignedTimeSeries, Marker, Track } from '../../stores/dataStructures/alignment';
import { SignalsViewMode } from '../../stores/dataStructures/labeling';
import { startDragging } from '../../stores/utils';
import { KeyCode } from '../../stores/dataStructures/types';
import * as stores from '../../stores/stores';
import { EventListenerComponent } from '../common/EventListenerComponent';
import { TimeAxis } from '../common/TimeAxis';
import { TrackView } from '../common/TrackView';
import { SVGGlyphiconButton } from '../svgcontrols/buttons';
import * as d3 from 'd3';
import * as React from 'react';
import { observer } from 'mobx-react';



export interface AlignmentViewProps {
    // Viewport size.
    viewWidth: number;
    viewHeight: number;
}

export interface AlignmentViewState {
    tracks?: Track[];
    pixelsPerSecond?: number;
    detailedViewStart?: number;

    isCreatingCorrespondence?: boolean;
    markerStartKnob?: 'top' | 'bottom';
    markerStart?: Marker;
    markerTarget?: Marker;
    currentPosition?: [number, number];

    signalsViewMode?: SignalsViewMode;
}

@observer
export class AlignmentView extends React.Component<AlignmentViewProps, AlignmentViewState> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: AlignmentViewProps, context: any) {
        super(props, context);

        this.state = this.computeState();

        this.updateState = this.updateState.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onTrackMouseMove = this.onTrackMouseMove.bind(this);
        this.onTrackMouseDown = this.onTrackMouseDown.bind(this);
        this.onTrackMouseEnter = this.onTrackMouseEnter.bind(this);
        this.onTrackMouseLeave = this.onTrackMouseLeave.bind(this);
        this.onTrackWheel = this.onTrackWheel.bind(this);
        this.getZoomTransform = this.getZoomTransform.bind(this);
    }

    protected updateState(): void {
        this.setState(this.computeState());
    }

    private computeState(): AlignmentViewState {
        return {
            tracks: stores.alignmentLabelingStore.tracks,
            detailedViewStart: stores.alignmentLabelingUiStore.referenceViewStart,
            pixelsPerSecond: stores.alignmentLabelingUiStore.referenceViewPPS,
            signalsViewMode: stores.labelingUiStore.signalsViewMode
        };
    }


    private onKeyDown(event: KeyboardEvent): void {
        if (event.srcElement === document.body) {
            if (event.keyCode === KeyCode.BACKSPACE || event.keyCode === KeyCode.DELETE) {
                if (stores.alignmentUiStore.selectedMarker) {
                    stores.alignmentStore.deleteMarker(stores.alignmentUiStore.selectedMarker);
                } else if (stores.alignmentUiStore.selectedCorrespondence) {
                    stores.alignmentStore.deleteMarkerCorrespondence(stores.alignmentUiStore.selectedCorrespondence);
                }
            }
        }
        if (event.ctrlKey && event.keyCode === 'Z'.charCodeAt(0)) {
            new actions.CommonActions.AlignmentUndo().dispatch();
        }
        if (event.ctrlKey && event.keyCode === 'Y'.charCodeAt(0)) {
            new actions.CommonActions.AlignmentRedo().dispatch();
        }
    }

    // In these events, t and pps are in the timeSeries' local time, not the reference time.
    private onTrackMouseMove(
        event: React.MouseEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, t: number, pps: number): void {
        if (timeSeries.aligned) {
            const scale = d3.scaleLinear()
                .domain([timeSeries.referenceStart, timeSeries.referenceEnd])
                .range([timeSeries.timeSeries[0].timestampStart, timeSeries.timeSeries[0].timestampEnd]);
            stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(scale.invert(t));
            stores.uiStore.setReferenceViewTimeCursor(scale.invert(t));

        } else {
            stores.alignmentUiStore.setSeriesTimeCursor(timeSeries, t);
        }
    }

    private onTrackMouseDown(
        event: React.MouseEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, t: number, pps: number): void {
        if (t < timeSeries.timeSeries[0].timestampStart || t > timeSeries.timeSeries[0].timestampEnd) { return; }
        const x0 = event.clientX;
        let moved = false;
        const rangeStart = stores.alignmentUiStore.getAlignmentState(timeSeries).rangeStart;
        const referenceRangeStart = stores.alignmentLabelingUiStore.referenceViewStart;
        startDragging(
            (mouseEvent: MouseEvent) => {
                const x1 = mouseEvent.clientX;
                if (moved || Math.abs(x1 - x0) >= 3) {
                    moved = true;
                    if (timeSeries.aligned) {
                        const dt = (x1 - x0) / stores.alignmentLabelingUiStore.referenceViewPPS;
                        stores.alignmentLabelingUiStore.setReferenceViewZoomingAction(referenceRangeStart - dt, null);
                    } else {
                        const dt = (x1 - x0) / pps;
                        stores.alignmentUiStore.setTimeSeriesZooming(timeSeries, rangeStart - dt, null);
                    }
                }
            },
            upEvent => {
                if (!moved) {
                    const marker: Marker = {
                        timeSeries: timeSeries,
                        localTimestamp: t
                    };
                    stores.alignmentStore.addMarker(marker);
                }
            });
    }

    private onTrackMouseLeave(event: React.MouseEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, t: number, pps: number): void {
        stores.alignmentUiStore.setSeriesTimeCursor(timeSeries, null);
    }

    private onTrackMouseEnter(event: React.MouseEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, t: number, pps: number): void {
        stores.alignmentUiStore.setSeriesTimeCursor(timeSeries, t);
    }


    private onTrackWheel(
        event: React.WheelEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, _: number, pps: number, deltaY: number): void {
        if (track === stores.alignmentLabelingStore.referenceTrack || timeSeries.aligned) {
            stores.alignmentLabelingUiStore.referenceViewPanAndZoom(0, deltaY / 1000, 'cursor');
            stores.uiStore.referenceViewPanAndZoom(0, deltaY / 1000, 'cursor');
        } else {
            const scale = d3.scaleLinear()
                .domain([timeSeries.referenceStart, timeSeries.referenceEnd])
                .range([timeSeries.timeSeries[0].timestampStart, timeSeries.timeSeries[0].timestampEnd]);
            const t = stores.alignmentUiStore.getTimeCursor(timeSeries);
            if (t === null) { return; }
            const { rangeStart: oldStart, pixelsPerSecond: oldPPS } =
                stores.alignmentUiStore.getAlignmentState(timeSeries);
            const k = Math.exp(-deltaY / 1000);
            const newPPS = oldPPS * k;
            const newStart = oldStart / k + scale.invert(t) * (1 - 1 / k);
            stores.alignmentUiStore.setTimeSeriesZooming(timeSeries, newStart, newPPS);
        }
    }


    private getRelativePosition(event: MouseEvent): number[] {
        const x: number = event.clientX - this.refs.interactionRect.getBoundingClientRect().left;
        const y: number = event.clientY - this.refs.interactionRect.getBoundingClientRect().top;
        return [x, y];
    }


    // When adding connections, find the candidate marker with the given event.
    private findCandidateMarker(event: MouseEvent): Marker {
        const target = event.target as Element;
        const ty = target.getAttribute('data-type');
        if (ty === 'marker') {
            const index = parseInt(target.getAttribute('data-marker-index'), 10);
            if (!isNaN(index)) {
                return stores.alignmentStore.markers[index];
            }
        }
        return null;
    }


    private startCreatingCorrespondence(marker: Marker, knob: 'top' | 'bottom', event: React.MouseEvent<Element>): void {
        // Select the marker first.
        stores.alignmentUiStore.selectMarker(marker);
        // Enter start creating correspondence state.
        this.setState({
            isCreatingCorrespondence: true,
            currentPosition: null,
            markerStartKnob: knob,
            markerStart: marker,
            markerTarget: null
        });

        startDragging(
            (moveEvent: MouseEvent) => {
                let candidate = this.findCandidateMarker(moveEvent);

                // Can't link to itself.
                if (candidate === this.state.markerStart) { candidate = null; }

                // Must link to track above/below.
                if (candidate) {
                    const trackIndex1 =
                        stores.alignmentLabelingStore.tracks.indexOf(this.state.markerStart.timeSeries.track);
                    const trackIndex2 = stores.alignmentLabelingStore.tracks.indexOf(candidate.timeSeries.track);
                    if (!(trackIndex2 === trackIndex1 - 1 || trackIndex2 === trackIndex1 + 1)) { candidate = null; }
                }

                const [x, y] = this.getRelativePosition(moveEvent);
                this.setState({
                    isCreatingCorrespondence: true,
                    markerStart: marker,
                    markerTarget: candidate,
                    currentPosition: [x, y]
                });
            },
            upEvent => {
                const lastCandidate = this.state.markerTarget;

                this.setState({
                    isCreatingCorrespondence: false,
                    markerStartKnob: null,
                    currentPosition: null,
                    markerStart: null,
                    markerTarget: null
                });

                if (lastCandidate !== marker && lastCandidate !== null) {
                    stores.alignmentStore.addMarkerCorrespondence(marker, lastCandidate);
                }
            });
    }


    private getMarkerLayout(marker: Marker): {
        x: number,
        pps: number,
        xScale: (x: number) => number,
        xScaleInvert: (x: number) => number,
        y0: number,
        y1: number
    } {
        const timeSeries = marker.timeSeries;
        const track = timeSeries.track;
        const trackLayout = stores.alignmentUiStore.getTrackLayout(track);
        if (!trackLayout) { return null; }
        const alignmentState = stores.alignmentUiStore.getAlignmentState(timeSeries);
        const [rangeStart, pixelsPerSecond] = alignmentState ?
            [alignmentState.rangeStart, alignmentState.pixelsPerSecond] :
            [this.state.detailedViewStart, this.state.pixelsPerSecond];
        // scale: Reference -> Pixel.
        const sReferenceToPixel = d3.scaleLinear()
            .domain([rangeStart, rangeStart + this.props.viewWidth / pixelsPerSecond])
            .range([0, this.props.viewWidth]);
        // scale: Signal -> Reference.
        const sSignalToReference = d3.scaleLinear()
            .domain([timeSeries.timeSeries[0].timestampStart, timeSeries.timeSeries[0].timestampEnd])
            .range([timeSeries.referenceStart, timeSeries.referenceEnd]);
        const x = sReferenceToPixel(sSignalToReference(marker.localTimestamp));
        const pps = sSignalToReference(sReferenceToPixel(1)) - sSignalToReference(sReferenceToPixel(0));
        return {
            x: x,
            pps: pps,
            xScale: (t) => sReferenceToPixel(sSignalToReference(t)),
            xScaleInvert: (xx) => sSignalToReference.invert(sReferenceToPixel.invert(xx)),
            y0: trackLayout.y0,
            y1: trackLayout.y1
        };
    }

    private getZoomTransform(series: AlignedTimeSeries): {
        rangeStart: number,
        pixelsPerSecond: number
    } {
        const state = stores.alignmentUiStore.getAlignmentState(series);
        if (!state) {
            return { rangeStart: this.state.detailedViewStart, pixelsPerSecond: this.state.pixelsPerSecond };
        } else {
            return { rangeStart: state.rangeStart, pixelsPerSecond: state.pixelsPerSecond };
        }
    }


    private renderTracks(): JSX.Element[] {
        return this.state.tracks.map(track => {
            const trackLayout = stores.alignmentUiStore.getTrackLayout(track);
            if (!trackLayout) { return null; }
            let timeAxis = null;
            if (!track.alignedTimeSeries[0].aligned) {
                const zoom = this.getZoomTransform(track.alignedTimeSeries[0]);
                const scale = d3.scaleLinear()
                    .domain([zoom.rangeStart, zoom.rangeStart + this.props.viewWidth / zoom.pixelsPerSecond])
                    .range([0, this.props.viewWidth]);
                timeAxis = <TimeAxis scale={scale} transform='translate(0, 0)' />;
            }
            return (
                <g transform={`translate(0, ${trackLayout.y0})`} key={track.id}>

                    {timeAxis}

                    <TrackView
                        track={track}
                        viewWidth={this.props.viewWidth}
                        viewHeight={trackLayout.height}
                        getTimeCursor={stores.alignmentUiStore.getTimeCursor}
                        enableMouseEvents={true}
                        onMouseMove={this.onTrackMouseMove}
                        onMouseDown={this.onTrackMouseDown}
                        onMouseEnter={this.onTrackMouseEnter}
                        onMouseLeave={this.onTrackMouseLeave}
                        onWheel={this.onTrackWheel}
                        zoomTransform={this.getZoomTransform}
                        useMipmap={true}
                        signalsViewMode={this.state.signalsViewMode}
                        />

                    <rect className='track-decoration'
                        x={this.props.viewWidth} y={0}
                        width={3} height={trackLayout.height} />

                    <g transform={`translate(${this.props.viewWidth + 4}, 0)`}>
                        <SVGGlyphiconButton x={0} y={0} width={20} height={20} text='remove'
                            onClick={event => stores.alignmentLabelingStore.deleteTrack(track)} />
                        <SVGGlyphiconButton x={0} y={20}
                            width={20} height={20}
                            text={track.minimized ? 'plus' : 'minus'}
                            onClick={event =>
                                stores.alignmentUiStore.setTrackMinimized(track, !track.minimized)} />
                    </g>
                </g>
            );
        });
    }


    private renderCorrespondences(): JSX.Element[] {
        return stores.alignmentStore.correspondences.map((correspondence, index) => {
            const l1 = this.getMarkerLayout(correspondence.marker1);
            const l2 = this.getMarkerLayout(correspondence.marker2);
            if (!l1 || !l2) { return; }
            const y1 = l1.y1 < l2.y0 ? l1.y1 : l1.y0;
            const y2 = l1.y1 < l2.y0 ? l2.y0 : l2.y1;
            const isSelected = stores.alignmentUiStore.selectedCorrespondence === correspondence;
            return (
                <g className={`marker-correspondence ${isSelected ? 'selected' : ''}`} key={`correspondence-${index}`}>
                    <line key={`correspondence-${index}`}
                        x1={l1.x} x2={l2.x} y1={y1} y2={y2}
                        />
                    <line className='handler'
                        key={`correspondence-handler-${index}`}
                        x1={l1.x} x2={l2.x} y1={y1} y2={y2}
                        onClick={() =>
                            stores.alignmentUiStore.selectMarkerCorrespondence(correspondence)}
                        />
                </g>
            );
        });
    }


    private renderMarkers(): JSX.Element[] {
        // Markers:
        const markers: JSX.Element[] = [];

        stores.alignmentStore.markers.forEach((marker, markerIndex) => {
            const r = 6;
            const rh = 10;
            const layout = this.getMarkerLayout(marker);
            if (!layout) { return; }
            const { x, y0, y1, pps } = layout;
            const isSelected = stores.alignmentUiStore.selectedMarker === marker;
            markers.push((
                <g
                    key={`marker-${markerIndex}`}
                    className={`alignment-marker ${
                        (this.state.isCreatingCorrespondence && this.state.markerTarget === marker) ? 'marker-target' : ''
                        } ${
                        (this.state.isCreatingCorrespondence && this.state.markerStart === marker) ? 'marker-start' : ''
                        } ${isSelected ? 'selected' : ''}`}
                    >
                    <line className='line'
                        x1={x} x2={x}
                        y1={y0} y2={y1}
                        />
                    <line className='handler'
                        x1={x} x2={x}
                        y1={y0} y2={y1}
                        onWheel={event => {
                            this.onTrackWheel(event, marker.timeSeries.track, marker.timeSeries, marker.localTimestamp, pps, event.deltaY);
                        } }
                        onMouseEnter={event => {
                            if (marker.timeSeries.track === stores.alignmentLabelingStore.referenceTrack) {
                                stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(marker.localTimestamp);
                                stores.uiStore.setReferenceViewTimeCursor(marker.localTimestamp);
                            } else {
                                stores.alignmentUiStore.setSeriesTimeCursor(marker.timeSeries, marker.localTimestamp);
                            }
                        } }
                        onMouseDown={event => {
                            stores.alignmentUiStore.selectMarker(marker);
                            let isFirstUpdate = true;
                            startDragging(
                                (moveEvent: MouseEvent) => {
                                    const newT = this.getMarkerLayout(marker).xScaleInvert(this.getRelativePosition(moveEvent)[0]);
                                    stores.alignmentStore.updateMarker(marker, newT, false, isFirstUpdate);
                                    isFirstUpdate = false;
                                    if (marker.timeSeries.track === stores.alignmentLabelingStore.referenceTrack) {
                                        stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(newT);
                                        stores.uiStore.setReferenceViewTimeCursor(newT);
                                    } else {
                                        stores.alignmentUiStore.setSeriesTimeCursor(marker.timeSeries, newT);
                                    }
                                },
                                () => { stores.alignmentStore.updateMarker(marker, marker.localTimestamp, true, false); }
                            );
                        } }
                        />
                    <circle
                        className='marker-circle'
                        cx={x} cy={y0} r={r}
                        />
                    <circle
                        className='marker-circle'
                        cx={x} cy={y1} r={r}
                        />
                    <circle
                        className='marker-handler'
                        cx={x} cy={y0} r={rh}
                        data-type='marker'
                        data-marker-index={markerIndex}
                        onMouseDown={event => this.startCreatingCorrespondence(marker, 'top', event)}
                        />
                    <circle
                        className='marker-handler'
                        cx={x} cy={y1} r={rh}
                        data-type='marker'
                        data-marker-index={markerIndex}
                        onMouseDown={event => this.startCreatingCorrespondence(marker, 'bottom', event)}
                        />
                </g>
            ));
            if (this.state.isCreatingCorrespondence &&
                this.state.markerStart === marker &&
                this.state.currentPosition) {
                markers.push((
                    <line key='temporary-correspondence' className='temporary-correspondence'
                        x1={x} y1={this.state.markerStartKnob === 'top' ? y0 : y1}
                        x2={this.state.currentPosition[0]} y2={this.state.currentPosition[1]}
                        />
                ));
            }
        });
        return markers;
    }


    public render(): JSX.Element {
        return (
            <g>
                <rect ref='interactionRect'
                    x={0} y={0}
                    width={this.props.viewWidth} height={this.props.viewHeight}
                    style={{ fill: 'none', stroke: 'none' }} />
                {this.renderTracks()}
                {this.renderCorrespondences()}
                {this.renderMarkers()}
            </g>
        );
    }
}
