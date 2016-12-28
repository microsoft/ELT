// AlignmentLabelingStore
// Stores the information about tracks and handles project load/save and undo/redo state saving.

import * as actions from '../actions/Actions';
import { AlignedTimeSeries, Track } from '../common/common';
import { SavedAlignedTimeSeries, SavedAlignmentSnapshot, SavedLabelingSnapshot, SavedProject, SavedTrack } from '../common/common';
import { loadMultipleSensorTimeSeriesFromFile, loadRawSensorTimeSeriesFromFile, loadVideoTimeSeriesFromFile, TimeSeries }
    from '../common/dataset';
import { globalDispatcher } from '../dispatcher/globalDispatcher';
import { HistoryTracker } from './HistoryTracker';
import { NodeEvent } from './NodeEvent';
import { alignmentLabelingUiStore, alignmentStore, labelingStore, uiStore } from './stores';
import { EventEmitter } from 'events';
import * as fs from 'fs';


// Try different names until cb(name) === true.
function attemptNames(name: string, cb: (name: string) => boolean): string {
    let okay = false;
    let candidate = '';
    for (let index = 1; !okay; index++) {
        candidate = name + index.toString();
        okay = cb(candidate);
    }
    return candidate;
}

// Deep copy an object.
function deepClone<Type>(obj: Type): Type {
    return JSON.parse(JSON.stringify(obj)); // Is there a better way?
}


export class MappedLabel {
    public className: string;
    public timestampStart: number;
    public timestampEnd: number;
    constructor(className: string, timestampStart: number, timestampEnd: number) {
        this.className = className;
        this.timestampStart = timestampStart;
        this.timestampEnd = timestampEnd;
    }
}


// AlignmentLabelingStore: Stores the information about tracks and handles project load/save and undo/redo state saving.
export class AlignmentLabelingStore extends EventEmitter {
    // Reference track and other tracks.
    private _referenceTrack: Track;
    private _tracks: Track[];

    // Track ID to actual track.
    private _trackIndex: Map<string, Track>;
    private _timeSeriesIndex: Map<string, AlignedTimeSeries>;

    // Stores alignment and labeling history (undo is implemented separately, you can't undo alignment from labeling or vice versa).
    private _alignmentHistory: HistoryTracker<SavedAlignmentSnapshot>;
    private _labelingHistory: HistoryTracker<SavedLabelingSnapshot>;

    // The location of the saved/opened project.
    private _projectFileLocation: string;


    public get referenceTrack(): Track { return this._referenceTrack; }
    public get tracks(): Track[] { return this._tracks; }

    public get projectFileLocation(): string { return this._projectFileLocation; }
    public set projectFileLocation(fileName: string) { this._projectFileLocation = fileName; }


    constructor() {
        super();

        this._alignmentHistory = new HistoryTracker<SavedAlignmentSnapshot>();
        this._labelingHistory = new HistoryTracker<SavedLabelingSnapshot>();

        this._referenceTrack = null;
        this._tracks = [];
        this.reindexTracksAndTimeSeries();

        this._projectFileLocation = null;

        globalDispatcher.register(action => {
            // Load the reference track.
            if (action instanceof actions.CommonActions.NewProject) {
                this.newProject();
            }

            if (action instanceof actions.CommonActions.LoadReferenceTrack) {
                this.alignmentHistoryRecord();
                loadVideoTimeSeriesFromFile(action.fileName, (video) => {
                    const track: Track = {
                        id: this.newTrackID(),
                        alignedTimeSeries: [],
                        minimized: false
                    };
                    track.alignedTimeSeries.push({
                        id: this.newTimeSeriesID(),
                        track: track,
                        referenceStart: 0,
                        referenceEnd: video.timestampEnd - video.timestampStart,
                        timeSeries: [video],
                        source: action.fileName,
                        aligned: false
                    });
                    this._referenceTrack = track;
                    this.reindexTracksAndTimeSeries();
                    this.tracksChanged.emit();
                });
            }

            // Load a video track.
            if (action instanceof actions.CommonActions.LoadVideoTrack) {
                this.alignmentHistoryRecord();
                loadVideoTimeSeriesFromFile(action.fileName, (video) => {
                    const track: Track = {
                        id: this.newTrackID(),
                        alignedTimeSeries: [],
                        minimized: false
                    };
                    track.alignedTimeSeries.push({
                        id: this.newTimeSeriesID(),
                        track: track,
                        referenceStart: 0,
                        referenceEnd: video.timestampEnd - video.timestampStart,
                        timeSeries: [video],
                        source: action.fileName,
                        aligned: false
                    });
                    this._tracks.push(track);
                    this.reindexTracksAndTimeSeries();
                    this.tracksChanged.emit();
                });
            }

            // Load a sensor track.
            if (action instanceof actions.CommonActions.LoadSensorTrack) {
                this.alignmentHistoryRecord();
                const sensors = loadMultipleSensorTimeSeriesFromFile(action.fileName);
                const track: Track = {
                    id: this.newTrackID(),
                    alignedTimeSeries: [],
                    minimized: false
                };
                track.alignedTimeSeries.push({
                    id: this.newTimeSeriesID(),
                    track: track,
                    referenceStart: 0,
                    referenceEnd: sensors[0].timestampEnd - sensors[0].timestampStart,
                    timeSeries: sensors,
                    source: action.fileName,
                    aligned: false
                });
                this._tracks.push(track);
                this.reindexTracksAndTimeSeries();
                this.tracksChanged.emit();
            }

            if (action instanceof actions.CommonActions.DeleteTrack) {
                this.alignmentHistoryRecord();
                const index = this._tracks.indexOf(action.track);
                this._tracks.splice(index, 1);
                this.reindexTracksAndTimeSeries();
                this.tracksChanged.emit();
            }

            if (action instanceof actions.CommonActions.SaveProject) {
                const project = this.saveProject();
                const json = JSON.stringify(project, null, 2);
                fs.writeFileSync(action.fileName, json, 'utf-8');
                this._projectFileLocation = action.fileName;
                this.addToRecentProjects(action.fileName);
            }

            if (action instanceof actions.CommonActions.ExportLabels) {
                this.exportLabels(action.fileName);
            }

            if (action instanceof actions.CommonActions.LoadProject) {
                try {
                    const json = fs.readFileSync(action.fileName, 'utf-8');
                    const project = JSON.parse(json);
                    this._projectFileLocation = null;
                    this.alignmentHistoryReset();
                    this.labelingHistoryReset();
                    this.loadProject(project as SavedProject, () => {
                        this._projectFileLocation = action.fileName;
                        this.addToRecentProjects(action.fileName);
                    });
                } catch (e) {
                    alert('Sorry, cannot load project file ' + action.fileName);
                }
            }

            if (action instanceof actions.CommonActions.AlignmentUndo) {
                this.alignmentUndo();
            }

            if (action instanceof actions.CommonActions.AlignmentRedo) {
                this.alignmentRedo();
            }

            if (action instanceof actions.CommonActions.LabelingUndo) {
                this.labelingUndo();
            }

            if (action instanceof actions.CommonActions.LabelingRedo) {
                this.labelingRedo();
            }
        });
    }


    // Recreate track index.
    private reindexTracksAndTimeSeries(): void {
        this._trackIndex = new Map<string, Track>();
        this._timeSeriesIndex = new Map<string, AlignedTimeSeries>();
        if (this._referenceTrack !== null) {
            const t = this._referenceTrack;
            this._trackIndex.set(t.id, t);
            t.alignedTimeSeries.forEach((ts) => {
                this._timeSeriesIndex.set(ts.id, ts);
            });
        }
        this.tracks.forEach((t) => {
            this._trackIndex.set(t.id, t);
            t.alignedTimeSeries.forEach((ts) => {
                this._timeSeriesIndex.set(ts.id, ts);
            });
        });
    }

    // Get timeseries by its ID.
    public getTimeSeriesByID(id: string): AlignedTimeSeries {
        return this._timeSeriesIndex.get(id);
    }
    // Get track by its ID.
    public getTrackByID(id: string): Track {
        return this._trackIndex.get(id);
    }

    // Create new non-conflicting IDs.
    public newTrackID(): string {
        return attemptNames('track-', id => this.getTrackByID(id) === undefined);
    }
    public newTimeSeriesID(): string {
        return attemptNames('series-', id => this.getTimeSeriesByID(id) === undefined);
    }

    // Tracks Changed event, when tracks are added/removed.
    public tracksChanged: NodeEvent = new NodeEvent(this, 'tracks-changed');

    // The list of recent project changed.
    public recentProjectsChanged: NodeEvent = new NodeEvent(this, 'recent-projects-changed');



    public get recentProjects(): string[] {
        const value = localStorage.getItem('recent-projects');
        if (!value || value === '') { return []; }
        return JSON.parse(value);
    }
    public addToRecentProjects(fileName: string): void {
        let existing = this.recentProjects;
        if (existing.indexOf(fileName) < 0) {
            existing = [fileName].concat(existing);
        } else {
            existing.splice(existing.indexOf(fileName), 1);
            existing = [fileName].concat(existing);
        }
        localStorage.setItem('recent-projects', JSON.stringify(existing));
        this.recentProjectsChanged.emit();
    }

    public saveProject(): SavedProject {
        const saveTimeSeries = (timeSeries: AlignedTimeSeries): SavedAlignedTimeSeries => {
            return {
                id: timeSeries.id,
                trackID: timeSeries.track.id,
                referenceStart: timeSeries.referenceStart,
                referenceEnd: timeSeries.referenceEnd,
                source: timeSeries.source,
                aligned: timeSeries.aligned
            };
        };
        const saveTrack = (track: Track): SavedTrack => {
            return {
                id: track.id,
                minimized: track.minimized,
                timeSeries: track.alignedTimeSeries.map(saveTimeSeries)
            };
        };

        return {
            referenceTrack: saveTrack(this.referenceTrack),
            tracks: this.tracks.map(saveTrack),
            metadata: {
                name: 'MyProject',
                timeSaved: new Date().getTime() / 1000
            },
            alignment: alignmentStore.saveState(),
            labeling: labelingStore.saveState(),
            ui: {
                currentTab: uiStore.currentTab,
                referenceViewStart: alignmentLabelingUiStore.referenceViewStart,
                referenceViewPPS: alignmentLabelingUiStore.referenceViewPPS
            }
        };
    }

    // TODO: might want to move some of this computation elsewhere 
    public exportLabels(fileName: string): void {
        // for each timeseries, get the source file, and save to a .labels file
        this.tracks.map((track) => {
            track.alignedTimeSeries.map((timeSeries) => {
                const sourceFile = timeSeries.source;
                //const destinationFile = sourceFile + '.labels.tsv';
                // read in the source file via dataset.ts (see loadMultipleSensorTimeSeriesFromFile)
                // you can also get the timestampStart and timestampEnd from this
                // which you want to map to timeSeries.referenceStart and timeSeries.referenceEnd
                const rawSensorData = loadRawSensorTimeSeriesFromFile(sourceFile);
                const localStart = rawSensorData.timestampStart;
                const localEnd = rawSensorData.timestampEnd;
                const referenceStart = timeSeries.referenceStart;
                const referenceEnd = timeSeries.referenceEnd;
                // use these to recompute k and b
                // TODO: figure out why we don't just store k and b for each timeSeries?
                const [k, b] = alignmentStore.solveForKandB(localStart, referenceStart, localEnd, referenceEnd);
                // get the labels from labelingStore .labels()
                // map the timestamps of the labels from the reference time to the time of the current time series
                // (i.e., localTime = (refTime - b)/k)
                const mappedLabels = labelingStore.labels.map((label) => {
                    return new MappedLabel(label.className, (label.timestampStart - b) / k, (label.timestampEnd - b) / k);
                });
                mappedLabels.sort((l1, l2) => l1.timestampStart - l2.timestampStart);
                // map the labels onto the source file by looking up the timeseries
                // add a column
                const countLabels = mappedLabels.length;
                const timeColumn = rawSensorData.timeColumn;
                const numRows = timeColumn.length;
                const annotatedSensorData: string[] = [];
                if (countLabels > 0) {
                    let currLabelIndex = 0;
                    let currentLabel = mappedLabels[currLabelIndex];
                    for (let i = 0; i < numRows; i++) {
                        const currentTime = timeColumn[i] / 1000;
                        if (currentTime > currentLabel.timestampStart && currentTime <= currentLabel.timestampEnd) {
                            annotatedSensorData[i] = rawSensorData.rawData[i].join('\t') + '\t' + currentLabel.className;
                        } else {
                            annotatedSensorData[i] = rawSensorData.rawData[i].join('\t') + '\t' + '';
                        }
                        if (currentTime >= currentLabel.timestampEnd && (currLabelIndex + 1) < countLabels) {
                            currLabelIndex++;
                            currentLabel = mappedLabels[currLabelIndex];
                        }
                    }
                }
                fs.writeFileSync(fileName, annotatedSensorData.join('\n'), 'utf-8');
            });
        });
    }

    public loadProject(project: SavedProject, loadProjectCallback: () => any): void {
        const deferred = new DeferredCallbacks();

        // Load TimeSeries data from a file.
        const loadContentFromFile = (fileName: string, callback: (timeSeries: TimeSeries[]) => void) => {
            if (fileName.match(/\.tsv$/i)) {
                const ts = loadMultipleSensorTimeSeriesFromFile(fileName);
                callback(ts);
            }
            if (fileName.match(/\.(webm|mp4|mov)$/i)) {
                loadVideoTimeSeriesFromFile(fileName, (ts) => {
                    callback([ts]);
                });
            }
        };

        // Load the AlignedTimeSeries structure.
        const loadTimeSeries = (track: Track, timeSeries: SavedAlignedTimeSeries): AlignedTimeSeries => {
            const result = {
                id: timeSeries.id,
                track: track,
                referenceStart: timeSeries.referenceStart,
                referenceEnd: timeSeries.referenceEnd,
                source: timeSeries.source,
                aligned: timeSeries.aligned,
                timeSeries: []
            };
            const cb = deferred.callback();
            loadContentFromFile(result.source, ts => {
                result.timeSeries = ts;
                cb();
            });
            return result;
        };

        // Load saved track.
        const loadTrack = (track: SavedTrack): Track => {
            const result = {
                id: track.id,
                minimized: track.minimized,
                alignedTimeSeries: []
            };
            result.alignedTimeSeries = track.timeSeries.map((ts) => loadTimeSeries(result, ts));
            return result;
        };

        // Load the tracks.
        const newReferenceTrack = loadTrack(project.referenceTrack);
        const newTracks = project.tracks.map(loadTrack);

        deferred.onComplete(() => {
            // Set the new tracks once they are loaded successfully.
            this._referenceTrack = newReferenceTrack;
            this._tracks = newTracks;
            this.reindexTracksAndTimeSeries();

            // We changed all tracks now.
            this.tracksChanged.emit();

            // Load alignment and labeling.
            alignmentStore.loadState(project.alignment);
            labelingStore.loadState(project.labeling);

            // TODO: Load the reference zooming info here.
            alignmentLabelingUiStore.setReferenceViewZooming(project.ui.referenceViewStart, project.ui.referenceViewPPS);
            // TODO: Load the tabs here.
            if (project.ui.currentTab === 'file') {
                uiStore.currentTab = 'alignment';
            } else {
                uiStore.currentTab = project.ui.currentTab;
            }

            if (loadProjectCallback) { loadProjectCallback(); }
        });
    }

    public newProject(): void {
        this._projectFileLocation = null;
        this._referenceTrack = null;
        this._tracks = [];
        this.reindexTracksAndTimeSeries();

        // We changed all tracks now.
        this.tracksChanged.emit();

        // Load alignment and labeling.
        alignmentStore.reset();
        labelingStore.reset();

        // TODO: Load the reference zooming info here.
        alignmentLabelingUiStore.setReferenceViewZooming(0, 1);
        // TODO: Load the tabs here.
        uiStore.currentTab = 'alignment';
    }

    public getAlignmentSnapshot(): SavedAlignmentSnapshot {
        const cloneTimeSeries = (parentTrack: Track, timeSeries: AlignedTimeSeries): AlignedTimeSeries => {
            return {
                id: timeSeries.id,
                track: parentTrack,
                source: timeSeries.source,
                timeSeries: timeSeries.timeSeries,
                referenceStart: timeSeries.referenceStart,
                referenceEnd: timeSeries.referenceEnd,
                aligned: timeSeries.aligned
            };
        };
        const cloneTrack = (track: Track): Track => {
            if (track === null) { return null; }
            const result = {
                id: track.id,
                alignedTimeSeries: [],
                minimized: track.minimized
            };
            result.alignedTimeSeries = track.alignedTimeSeries.map((x) => cloneTimeSeries(result, x));
            return result;
        };
        return {
            referenceTrack: cloneTrack(this._referenceTrack),
            tracks: this._tracks.map(cloneTrack),
            alignment: alignmentStore.saveState()
        };
    }

    public loadAlignmentSnapshot(snapshot: SavedAlignmentSnapshot): void {
        this._referenceTrack = snapshot.referenceTrack;
        this._tracks = snapshot.tracks;
        this.reindexTracksAndTimeSeries();
        this.tracksChanged.emit();
        alignmentStore.loadState(snapshot.alignment);
    }

    public getLabelingSnapshot(): SavedLabelingSnapshot {
        return {
            labeling: deepClone(labelingStore.saveState())
        };
    }

    public loadLabelingSnapshot(snapshot: SavedLabelingSnapshot): void {
        labelingStore.loadState(snapshot.labeling);
    }

    public alignmentHistoryRecord(): void {
        this._alignmentHistory.add(this.getAlignmentSnapshot());
    }

    public alignmentHistoryReset(): void {
        this._alignmentHistory.reset();
    }

    public labelingHistoryRecord(): void {
        this._labelingHistory.add(this.getLabelingSnapshot());
    }

    public labelingHistoryReset(): void {
        this._labelingHistory.reset();
    }

    public alignmentUndo(): void {
        const snapshot = this._alignmentHistory.undo(this.getAlignmentSnapshot());
        if (snapshot) {
            this.loadAlignmentSnapshot(snapshot);
        }
    }

    public alignmentRedo(): void {
        const snapshot = this._alignmentHistory.redo(this.getAlignmentSnapshot());
        if (snapshot) {
            this.loadAlignmentSnapshot(snapshot);
        }
    }

    public labelingUndo(): void {
        const snapshot = this._labelingHistory.undo(this.getLabelingSnapshot());
        if (snapshot) {
            this.loadLabelingSnapshot(snapshot);
        }
    }

    public labelingRedo(): void {
        const snapshot = this._labelingHistory.redo(this.getLabelingSnapshot());
        if (snapshot) {
            this.loadLabelingSnapshot(snapshot);
        }
    }
}









class DeferredCallbacks {
    private _waitingCount: number;
    private _onComplete: () => void;

    constructor() {
        this._waitingCount = 0;
        this._onComplete = null;
    }

    public callback(): () => void {
        this._waitingCount += 1;
        return () => {
            this._waitingCount -= 1;
            this.triggerIfZero();
        };
    }

    private triggerIfZero(): void {
        if (this._waitingCount === 0) {
            if (this._onComplete) {
                this._onComplete();
                this._onComplete = null;
            }
        }
    }

    public onComplete(callback: () => void): void {
        this._onComplete = callback;
        this.triggerIfZero();
    }
}
