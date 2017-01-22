// Alignment main view.
// - Including tracks (but not the reference track), markers and correspondences.
// - Handles alignment keyboard events.

import { AlignedTimeSeries, Marker, Track } from '../../stores/dataStructures/alignment';
import { LayoutParameters } from '../../stores/dataStructures/LayoutParameters';
import { KeyCode } from '../../stores/dataStructures/types';
import * as stores from '../../stores/stores';
import { startDragging } from '../../stores/utils';
import { TimeAxis } from '../common/TimeAxis';
import { TrackView } from '../common/TrackView';
import { SVGGlyphiconButton } from '../svgcontrols/buttons';
import * as d3 from 'd3';
import { observer } from 'mobx-react';
import * as React from 'react';


export interface TrackLayout {
    y0: number;
    y1: number;
    height: number;
}

export interface AlignmentViewProps {
    // Viewport size.
    viewWidth: number;
    viewHeight: number;
}

export interface AlignmentViewState {
    isCreatingCorrespondence?: boolean;
    markerStartKnob?: 'top' | 'bottom';
    markerStart?: Marker;
    markerTarget?: Marker;
    currentPosition?: [number, number];
}

@observer
export class AlignmentView extends React.Component<AlignmentViewProps, AlignmentViewState> {
    public refs: {
        [key: string]: Element,
        interactionRect: Element
    };

    constructor(props: AlignmentViewProps, context: any) {
        super(props, context);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onTrackMouseMove = this.onTrackMouseMove.bind(this);
        this.onTrackMouseDown = this.onTrackMouseDown.bind(this);
        this.onTrackMouseEnter = this.onTrackMouseEnter.bind(this);
        this.onTrackMouseLeave = this.onTrackMouseLeave.bind(this);
        this.onTrackWheel = this.onTrackWheel.bind(this);
        this.getZoomTransform = this.getZoomTransform.bind(this);
        this.state = {};
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
            stores.alignmentLabelingStore.alignmentUndo();
        }
        if (event.ctrlKey && event.keyCode === 'Y'.charCodeAt(0)) {
            stores.alignmentLabelingStore.alignmentRedo();
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
        } else {
            stores.alignmentUiStore.setSeriesTimeCursor(timeSeries, t);
        }
    }

    private onTrackMouseDown(
        event: React.MouseEvent<Element>, track: Track, timeSeries: AlignedTimeSeries, t: number, pps: number): void {
        if (t < timeSeries.timeSeries[0].timestampStart || t > timeSeries.timeSeries[0].timestampEnd) { return; }
        const x0 = event.clientX;
        let moved = false;
        const rangeStart = stores.alignmentUiStore.getAlignmentParameters(timeSeries).rangeStart;
        const referenceRangeStart = stores.alignmentLabelingUiStore.referenceViewStart;
        startDragging(
            (mouseEvent: MouseEvent) => {
                const x1 = mouseEvent.clientX;
                if (moved || Math.abs(x1 - x0) >= 3) {
                    moved = true;
                    if (timeSeries.aligned) {
                        const dt = (x1 - x0) / stores.alignmentLabelingUiStore.referenceViewPPS;
                        stores.alignmentLabelingUiStore.setReferenceViewZooming(referenceRangeStart - dt, null);
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
        event: React.WheelEvent<Element>, trackId: string, timeSeries: AlignedTimeSeries, _: number, pps: number, deltaY: number): void {
        if (trackId === stores.alignmentLabelingStore.referenceTrack.id || timeSeries.aligned) {
            stores.alignmentLabelingUiStore.referenceViewPanAndZoom(0, deltaY / 1000, 'cursor');
        } else {
            const scale = d3.scaleLinear()
                .domain([timeSeries.referenceStart, timeSeries.referenceEnd])
                .range([timeSeries.timeSeries[0].timestampStart, timeSeries.timeSeries[0].timestampEnd]);
            const t = stores.alignmentUiStore.getTimeCursor(timeSeries);
            if (t === null) { return; }
            const { rangeStart: oldStart, pixelsPerSecond: oldPPS } =
                stores.alignmentUiStore.getAlignmentParameters(timeSeries);
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
                        stores.alignmentLabelingStore.tracks.map(t => t.id)
                            .indexOf(this.state.markerStart.timeSeries.trackId);
                    const trackIndex2 =
                        stores.alignmentLabelingStore.tracks.map(t => t.id)
                            .indexOf(candidate.timeSeries.trackId);
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

                if (lastCandidate && lastCandidate !== marker) {
                    stores.alignmentStore.addMarkerCorrespondence(marker, lastCandidate);
                }
            });
    }


    private getMarkerLayout(marker: Marker, layoutMap: Map<string, TrackLayout>): {
        x: number,
        pps: number,
        xScale: (x: number) => number,
        xScaleInvert: (x: number) => number,
        y0: number,
        y1: number
    } {
        const timeSeries = marker.timeSeries;
        const trackLayout = layoutMap.get(timeSeries.trackId);
        if (!trackLayout) { return null; }
        const alignmentState = stores.alignmentUiStore.getAlignmentParameters(timeSeries);
        const [rangeStart, pixelsPerSecond] = [alignmentState.rangeStart, alignmentState.pixelsPerSecond];
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
            xScale: t => sReferenceToPixel(sSignalToReference(t)),
            xScaleInvert: xx => sSignalToReference.invert(sReferenceToPixel.invert(xx)),
            y0: trackLayout.y0,
            y1: trackLayout.y1
        };
    }

    private getZoomTransform(series: AlignedTimeSeries): {
        rangeStart: number,
        pixelsPerSecond: number
    } {
        // const alignmentParms = stores.alignmentUiStore.getAlignmentParameters(series);
        // if (!alignmentParms) {
        //     return {
        //         rangeStart: stores.alignmentLabelingUiStore.referenceViewStart,
        //         pixelsPerSecond: stores.alignmentLabelingUiStore.referenceViewPPS
        //     };
        // } else {
        //     return { rangeStart: alignmentParms.rangeStart, pixelsPerSecond: alignmentParms.pixelsPerSecond };
        // }
        return stores.alignmentUiStore.getAlignmentParameters(series);
    }


    private computeTrackLayout(): Map<string, TrackLayout> {
        const map = new Map<string, TrackLayout>();

        const smallOffset = 0;
        const axisOffset = 22;
        let trackYCurrent = LayoutParameters.alignmentTrackYOffset;
        const trackHeight = LayoutParameters.alignmentTrackHeight;
        const trackMinimizedHeight = LayoutParameters.alignmentTrackMinimizedHeight;
        const trackGap = LayoutParameters.alignmentTrackGap;
        const referenceTrack = stores.alignmentLabelingStore.referenceTrack;
        if (referenceTrack) {
            map.set(referenceTrack.id, {
                y0: axisOffset + smallOffset - LayoutParameters.referenceDetailedViewHeightAlignment,
                y1: axisOffset + smallOffset,
                height: LayoutParameters.referenceDetailedViewHeightAlignment
            });
        }
        stores.alignmentLabelingStore.tracks.forEach(track => {
            const trackY = trackYCurrent;
            const height = track.minimized ? trackMinimizedHeight : trackHeight;
            map.set(track.id, {
                y0: trackY,
                y1: trackY + height,
                height: height
            });
            trackYCurrent += height + trackGap;
        });
        return map;
    }


    private renderTracks(layoutMap: Map<string, TrackLayout>): JSX.Element[] {
        return stores.alignmentLabelingStore.tracks.map(track => {
            const trackLayout = layoutMap.get(track.id);
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
                        signalsViewMode={stores.labelingUiStore.signalsViewMode}
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


    private renderCorrespondences(layoutMap: Map<string, TrackLayout>): JSX.Element[] {
        return stores.alignmentStore.correspondences.map((correspondence, index) => {
            const l1 = this.getMarkerLayout(correspondence.marker1, layoutMap);
            const l2 = this.getMarkerLayout(correspondence.marker2, layoutMap);
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


    private renderMarkers(layoutMap: Map<string, TrackLayout>): JSX.Element[] {
        // Markers:
        const markers: JSX.Element[] = [];

        stores.alignmentStore.markers.forEach((marker, markerIndex) => {
            const r = 6;
            const rh = 10;
            const layout = this.getMarkerLayout(marker, layoutMap);
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
                            this.onTrackWheel(
                                event, marker.timeSeries.trackId, marker.timeSeries, marker.localTimestamp, pps, event.deltaY);
                        } }
                        onMouseEnter={event => {
                            if (marker.timeSeries.trackId === stores.alignmentLabelingStore.referenceTrack.id) {
                                stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(marker.localTimestamp);
                            } else {
                                stores.alignmentUiStore.setSeriesTimeCursor(marker.timeSeries, marker.localTimestamp);
                            }
                        } }
                        onMouseDown={event => {
                            stores.alignmentUiStore.selectMarker(marker);
                            let isFirstUpdate = true;
                            startDragging(
                                (moveEvent: MouseEvent) => {
                                    const newT = this.getMarkerLayout(marker, layoutMap)
                                        .xScaleInvert(this.getRelativePosition(moveEvent)[0]);
                                    stores.alignmentStore.updateMarker(marker, newT, false, isFirstUpdate);
                                    isFirstUpdate = false;
                                    if (marker.timeSeries.trackId === stores.alignmentLabelingStore.referenceTrack.id) {
                                        stores.alignmentLabelingUiStore.setReferenceViewTimeCursor(newT);
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
        const layoutMap = this.computeTrackLayout();
        return (
            <g>
                <rect ref='interactionRect'
                    x={0} y={0}
                    width={this.props.viewWidth} height={this.props.viewHeight}
                    style={{ fill: 'none', stroke: 'none' }} />
                {this.renderTracks(layoutMap)}
                {this.renderCorrespondences(layoutMap)}
                {this.renderMarkers(layoutMap)}
            </g>
        );
    }
}
