import {VideoTimeSeries} from '../../stores/dataStructures/dataset';
import * as React from 'react';

// Component VideoRangePlot
// Display a video as frame thumbnails.
export interface VideoRangePlotProps {
    timeSeries: VideoTimeSeries;    // The VideoTimeSeries object to display.
    pixelsPerSecond: number;        // Scaling factor.
    plotWidth: number;              // Width of the plot.
    plotHeight: number;             // Height of the plot.
    rangeStart: number;             // The time of the leftmost part of the plot.
    thumbnailSpacing?: number;      // The time spacing between two thumbnails. If not specified, automatically compute it.
    timeFirstThumbnail?: number;    // The time of the first thumbnail. If not specified, use timeSeries.timestampStart.
}


export class VideoRangePlot extends React.Component<VideoRangePlotProps, {}> {

    public shouldComponentUpdate(nextProps: VideoRangePlotProps): boolean {
        // We consider the timeSeries object and colorScale constant, so any change inside these objects will not trigger an update.
        // To change the timeSeries, replace it with another object, don't update it directly.
        return nextProps.timeSeries !== this.props.timeSeries ||
            nextProps.pixelsPerSecond !== this.props.pixelsPerSecond ||
            nextProps.plotWidth !== this.props.plotWidth ||
            nextProps.plotHeight !== this.props.plotHeight ||
            nextProps.rangeStart !== this.props.rangeStart;
    }

    public render(): JSX.Element {
        const frameHeight = this.props.plotHeight;
        const frameWidth = frameHeight / this.props.timeSeries.height * this.props.timeSeries.width;

        const pixelsPerSecond = this.props.pixelsPerSecond;
        const rangeStart = this.props.rangeStart;
        const rangeEnd = this.props.rangeStart + this.props.plotWidth / pixelsPerSecond;
        const timeFirstThumbnail = this.props.timeFirstThumbnail !== undefined ?
            this.props.timeFirstThumbnail :
            this.props.timeSeries.timestampStart;
        const thumbnailSpacing = this.props.thumbnailSpacing !== undefined ? this.props.thumbnailSpacing : frameWidth / pixelsPerSecond;

        // Indecies should satisfy:
        // (timeFirstThumbnail + i * thumbnailSpacing) ~ [ rangeStart - frameWidth / 2 / pps, rangeEnd + frameWidth / 2 / pps ]
        const iMin = Math.floor(((rangeStart - frameWidth / 2 / pixelsPerSecond) - timeFirstThumbnail) / thumbnailSpacing);
        const iMax = Math.ceil(((rangeEnd + frameWidth / 2 / pixelsPerSecond) - timeFirstThumbnail) / thumbnailSpacing);

        const frames: JSX.Element[] = [];

        for (let i = iMin; i <= iMax; i++) {
            const t = timeFirstThumbnail + i * thumbnailSpacing;
            const xMiddle = (t - rangeStart) * pixelsPerSecond;
            if (t >= this.props.timeSeries.timestampStart && t <= this.props.timeSeries.timestampEnd) {
                frames.push(
                    <VideoFrameImage
                        key={`frame-${t}`}
                        timeSeries={this.props.timeSeries}
                        timeCursor={t}
                        x={xMiddle - frameWidth / 2}
                        y={0}
                        width={frameWidth}
                        height={frameHeight}
                        />
                );
            }
        }

        const clippathID = 'clip' + this.props.timeSeries.name;

        return (
            <g>
                <defs>
                    <clipPath id={clippathID}>
                        <rect
                            x={0} y={-2} width={this.props.plotWidth} height={this.props.plotHeight}
                            />
                    </clipPath>
                </defs>
                <g clipPath={`url(#${clippathID})`}>
                    {frames}
                </g>
            </g>
        );
    }
}




// Component VideoPlayer
// Play the video or show a frame of the video.
export interface VideoPlayerProps {
    timeSeries: VideoTimeSeries;             // The VideoTimeSeries to show/play.
    timeCursor: number;                      // The time to show or start to play.
    play?: boolean;                          // If play === true, play the video from timeCursor and emit onTimeUpdate;
    // if play === false, stop the video, and show frame at timeCursor.
    onTimeUpdate?: (time: number) => void;   // Event handler for playing time.
}

export class VideoPlayer extends React.Component<VideoPlayerProps, {}> {
    public refs: {
        [key: string]: Element,
        video: (HTMLVideoElement)
    };

    private seriesTimeToVideoTime(t: number): number {
        return (t - this.props.timeSeries.timestampStart) /
            (this.props.timeSeries.timestampEnd - this.props.timeSeries.timestampStart) * this.refs.video.duration;
    }

    private videoTimeToSeriesTime(t: number): number {
        return t / this.refs.video.duration *
            (this.props.timeSeries.timestampEnd - this.props.timeSeries.timestampStart) + this.props.timeSeries.timestampStart;
    }

    public componentDidMount(): void {
        const time = this.seriesTimeToVideoTime(this.props.timeCursor);
        if (time != null && !isNaN(time)) {
            this.refs.video.currentTime = time;
        }
        if (this.props.play) { this.refs.video.play(); }
    }

    public componentWillReceiveProps(newProps: VideoPlayerProps): void {
        if (!this.refs.video) { return; }

        if (!newProps.play) {
            if (this.props.play) { this.refs.video.pause(); }

            const time = this.seriesTimeToVideoTime(newProps.timeCursor);
            if (time != null && !isNaN(time)) {
                this.refs.video.currentTime = time;
            } else {
                // this.refs.video.currentTime = 0;
            }
        } else {
            if (!this.props.play) {
                const time = this.seriesTimeToVideoTime(newProps.timeCursor);
                if (time != null && !isNaN(time)) {
                    this.refs.video.currentTime = time;
                }
                this.refs.video.play();
            }
        }
    }

    public render(): JSX.Element {
        return (
            <video
                preload='true'
                src={this.props.timeSeries.filename}
                onTimeUpdate={
                    event => {
                        if (this.props.play) {
                            if (this.props.onTimeUpdate) {
                                this.props.onTimeUpdate(this.videoTimeToSeriesTime(this.refs.video.currentTime));
                            }
                        }
                    }
                }
                ref='video'
                width={300}
                />
        );
    }
}



// VideoFrameCache and VideoFrameCacheManager loads frames from videos asynchronously.
// VideoFrameCache caches a single video, VideoFrameCacheManager creates VideoFrameCache for each video.
// Note, although these are called 'cache', currently we don't actually cache frames.
export class VideoFrameCache {
    private src: string;
    private videoElement: HTMLVideoElement;
    private canvasElement: HTMLCanvasElement;
    private isSeeking: boolean;
    private isDurationLoaded: boolean;

    private callbackQueue: [number, Function][];
    private durationListeners: Function[];

    private canceledCallbacks: WeakSet<Function>;

    // src: the source URL of the video.
    constructor(src: string) {
        this.src = src;
        this.videoElement = document.createElement('video');
        this.canvasElement = document.createElement('canvas');
        this.callbackQueue = [];
        this.durationListeners = [];
        this.isSeeking = false;
        this.isDurationLoaded = false;
        this.canceledCallbacks = new WeakSet<Function>();

        this.videoElement.src = this.src;
        this.videoElement.onseeked = this.onSeeked.bind(this);
        this.videoElement.onloadedmetadata = this.onLoadedMetadata.bind(this);
    }

    // Get a frame at time as png dataurl.
    public getFrame(time: number, callback: (image: string) => void): void {
        this.callbackQueue.push([time, callback]);
        if (!this.isSeeking) { this.start(); }
    }

    // Cancel a getFrame request (provide the original callback object).
    public cancelGetFrame(callback: (image: string) => void): void {
        this.canceledCallbacks.add(callback);
    }

    // Get the duration of the video. callback will be called immediately if the video is already loaded.
    public getDuration(callback: (duration: number) => void): void {
        if (!this.isDurationLoaded) {
            this.durationListeners.push(callback);
        } else {
            callback(this.videoElement.duration);
        }
    }

    private start(): void {
        while (this.callbackQueue.length > 0 && this.canceledCallbacks.has(this.callbackQueue[0][1])) {
            this.callbackQueue.splice(0, 1);
        }
        if (this.callbackQueue.length > 0) {
            this.isSeeking = true;
            this.videoElement.currentTime = this.callbackQueue[0][0];
        }
    }

    private onLoadedMetadata(): void {
        this.isDurationLoaded = true;
        this.durationListeners.forEach(x => x(this.videoElement.duration));
    }

    private onSeeked(): void {
        this.isSeeking = false;
        const width = 240;
        const height = width / this.videoElement.videoWidth * this.videoElement.videoHeight;
        this.canvasElement.width = width;
        this.canvasElement.height = height;
        const ctx = this.canvasElement.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0, width, height);
        const image = this.canvasElement.toDataURL('image/png');
        const lastItem = this.callbackQueue.splice(0, 1)[0];
        this.start();
        lastItem[1](image);
    }
}



export class VideoFrameCacheManager {
    private videoCaches: Map<string, VideoFrameCache>;

    constructor() {
        this.videoCaches = new Map<string, VideoFrameCache>();
    }

    // Get a frame at time as png dataurl.
    public getFrame(video: string, time: number, callback: (image: string) => void): void {
        if (!this.videoCaches.has(video)) {
            this.videoCaches.set(video, new VideoFrameCache(video));
        }
        this.videoCaches.get(video).getFrame(time, callback);
    }

    // Get the duration of the video. callback will be called immediately if the video is already loaded.
    public getDuration(video: string, callback: (duration: number) => void): void {
        if (!this.videoCaches.has(video)) {
            this.videoCaches.set(video, new VideoFrameCache(video));
        }
        this.videoCaches.get(video).getDuration(callback);
    }

    // Cancel a getFrame request (provide the original callback object).
    public cancelGetFrame(video: string, callback: (image: string) => void): void {
        if (!this.videoCaches.has(video)) {
            this.videoCaches.set(video, new VideoFrameCache(video));
        }
        this.videoCaches.get(video).cancelGetFrame(callback);
    }
}



// Global VideoFrameCacheManager for the video frame components.
const videoFrameCache = new VideoFrameCacheManager();


// Component VideoFrameThumbnailDisplay
// Display a frame of a video.
// Can be embedded into a SVG.
export interface VideoFrameImageProps {
    timeSeries: VideoTimeSeries;             // The VideoTimeSeries to show/play.
    timeCursor: number;                      // The time to show or start to play.
    x: number;                               // x, y, width, height for the frame.
    y: number;
    width: number;
    height: number;
}


export class VideoFrameImage extends React.Component<VideoFrameImageProps, {}> {
    public refs: {
        [key: string]: Element,
        image: Element
    };

    private currentVideo: string;
    private currentTime: number;
    private previousCallback: (image: string) => void;

    private updateVideo(): void {
        if (!this.refs.image) { return; }
        // Check if we need to update.
        if (this.props.timeSeries.filename !== this.currentVideo || this.props.timeCursor !== this.currentTime) {
            this.currentTime = this.props.timeCursor;
            this.currentVideo = this.props.timeSeries.filename;
            videoFrameCache.getDuration(this.props.timeSeries.filename, (duration: number) => {
                const videoTime = (this.props.timeCursor - this.props.timeSeries.timestampStart) /
                    (this.props.timeSeries.timestampEnd - this.props.timeSeries.timestampStart) * duration;
                const cb = (image: string) => {
                    if (!this.refs.image) { return; }
                    this.refs.image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', image);
                };
                if (this.previousCallback) {
                    videoFrameCache.cancelGetFrame(this.props.timeSeries.filename, this.previousCallback);
                }
                this.previousCallback = cb;
                videoFrameCache.getFrame(this.props.timeSeries.filename, videoTime, cb);
            });
        }
    }

    public componentWillUnmount(): void {
        if (this.previousCallback) {
            videoFrameCache.cancelGetFrame(this.props.timeSeries.filename, this.previousCallback);
        }
    }

    public componentDidMount(): void {
        this.updateVideo();
    }

    public componentDidUpdate(): void {
        this.updateVideo();
    }

    public render(): JSX.Element {
        return (
            <g>
                <image
                    ref='image'
                    x={this.props.x}
                    y={this.props.y}
                    width={this.props.width}
                    height={this.props.height}
                    />
                <rect x={this.props.x}
                    y={this.props.y}
                    width={this.props.width}
                    height={this.props.height}
                    fill='transparent' stroke='white' strokeWidth='2' />
            </g>
        );
    }
}



// Component VideoFrameThumbnailDisplay
// Display a frame of a video with a HTML5 video element, suitable for larger frame sizes, and seek faster.
// Can be embedded into a SVG.
// Use with caution, this will mess up with the rendering order of the SVG (seems always rendered at the bottom).
export class VideoFrame extends React.Component<VideoFrameImageProps, {}> {
    public refs: {
        [key: string]: Element,
        video: HTMLVideoElement
    };

    public componentWillReceiveProps(newProps: VideoFrameImageProps): void {
        if (!this.refs.video) { return; }
        const time = (newProps.timeCursor - this.props.timeSeries.timestampStart) /
            (this.props.timeSeries.timestampEnd - this.props.timeSeries.timestampStart) * this.refs.video.duration;
        if (time != null && !isNaN(time)) {
            this.refs.video.currentTime = time;
        }
    }

    public render(): JSX.Element {
        return (
            <g transform={`translate(${this.props.x},${this.props.y})`} >
                <rect width={this.props.width} height={this.props.height}
                    stroke='black' fill='transparent' strokeWidth='1' />
                <foreignObject width={this.props.width} height={this.props.height}>
                    <span style={{ position: 'fixed', overflow: 'hidden', zIndex: -1 }}>
                        <video ref='video'
                            width={this.props.width * window.devicePixelRatio}
                            height={this.props.height * window.devicePixelRatio}
                            src={this.props.timeSeries.filename}
                            controls={false}
                            />
                    </span>
                </foreignObject>
            </g >
        );
    }
}
