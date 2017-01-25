// AlignmentLabelingStore
// Stores the information about tracks and handles project load/save and undo/redo state saving.

import { AlignedTimeSeries, Track } from '../stores/dataStructures/alignment';
import { loadMultipleSensorTimeSeriesFromFile, loadRawSensorTimeSeriesFromFile, loadVideoTimeSeriesFromFile, TimeSeries }
    from '../stores/dataStructures/dataset';
import { SavedAlignedTimeSeries, SavedAlignmentSnapshot, SavedLabelingSnapshot, SavedProject, SavedTrack }
    from '../stores/dataStructures/project';
import { HistoryTracker } from './HistoryTracker';
import { alignmentStore, labelingStore, projectUiStore } from './stores';
import * as d3 from 'd3';
import * as fs from 'fs';
import { action, computed, observable, runInAction } from 'mobx';




// Deep copy an object.
function deepClone<Type>(obj: Type): Type {
    return JSON.parse(JSON.stringify(obj)); // Is there a better way?
}

class MappedLabel {
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
export class ProjectStore {

    // Reference track and other tracks.
    @observable public referenceTrack: Track;
    @observable public tracks: Track[];

    // The location of the saved/opened project.
    @observable public projectFileLocation: string;

    // Stores alignment and labeling history (undo is implemented separately, you can't undo alignment from labeling or vice versa).
    private _alignmentHistory: HistoryTracker<SavedAlignmentSnapshot>;
    private _labelingHistory: HistoryTracker<SavedLabelingSnapshot>;

    constructor() {
        this._alignmentHistory = new HistoryTracker<SavedAlignmentSnapshot>();
        this._labelingHistory = new HistoryTracker<SavedLabelingSnapshot>();
        this.referenceTrack = null;
        this.tracks = [];
        this.projectFileLocation = null;
    }


    public getTimeSeriesByID(id: string): AlignedTimeSeries {
        // There are so few tracks/timeseries that linear search is fine.
        this.tracks.concat(this.referenceTrack).forEach(t => {
            const found = t.alignedTimeSeries.filter(ts => ts.id === id);
            if (found.length) { return found[0]; }
        });
        return undefined;
    }

    public getTrackByID(id: string): Track {
        // There are so few tracks that linear search is fine.
        return this.tracks.concat(this.referenceTrack).filter(t => t.id === id)[0];
    }

    // Keep the time range of the reference track.
    @computed public get referenceTimestampStart(): number {
        return this.referenceTrack && this.referenceTrack.alignedTimeSeries ?
            d3.min(this.referenceTrack.alignedTimeSeries, x => x.referenceStart)
            : 0;
    }

    @computed public get referenceTimestampEnd(): number {
        return this.referenceTrack && this.referenceTrack.alignedTimeSeries ?
            d3.max(this.referenceTrack.alignedTimeSeries, x => x.referenceEnd)
            : 100;
    }


    @action
    public loadReferenceTrack(fileName: string): void {
        this.alignmentHistoryRecord();
        loadVideoTimeSeriesFromFile(fileName, video => {
            this.referenceTrack = Track.fromFile(fileName, [video]);
        });
    }

    @action
    public loadVideoTrack(fileName: string): void {
        this.alignmentHistoryRecord();
        loadVideoTimeSeriesFromFile(fileName, video => {
            this.tracks.push(Track.fromFile(fileName, [video]));
        });
    }

    @action
    public loadSensorTrack(fileName: string): void {
        this.alignmentHistoryRecord();
        const sensors = loadMultipleSensorTimeSeriesFromFile(fileName);
        this.tracks.push(Track.fromFile(fileName, sensors));
    }

    @action
    public deleteTrack(track: Track): void {
        this.alignmentHistoryRecord();
        const index = this.tracks.indexOf(track);
        this.tracks.splice(index, 1);
    }

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
    }

    @action
    public loadProject(fileName: string): void {
        try {
            const json = fs.readFileSync(fileName, 'utf-8');
            const project = JSON.parse(json);
            this.projectFileLocation = null;
            this.alignmentHistoryReset();
            this.labelingHistoryReset();
            this.loadProjectHelper(project as SavedProject, () => {
                this.projectFileLocation = fileName;
                this.addToRecentProjects(fileName);
            });
        } catch (e) {
            alert('Sorry, cannot load project file ' + fileName);
        }
    }

    @action
    public saveProject(fileName: string): void {
        const project = this.saveProjectHelper();
        const json = JSON.stringify(project, null, 2);
        fs.writeFileSync(fileName, json, 'utf-8');
        this.projectFileLocation = fileName;
        this.addToRecentProjects(fileName);
    }

    private saveProjectHelper(): SavedProject {
        const saveTimeSeries = (timeSeries: AlignedTimeSeries): SavedAlignedTimeSeries => {
            return {
                id: timeSeries.id,
                trackID: timeSeries.trackId,
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
                currentTab: projectUiStore.currentTab,
                referenceViewStart: projectUiStore.referenceViewStart,
                referenceViewPPS: projectUiStore.referenceViewPPS
            }
        };
    }

    // TODO: might want to move some of this computation elsewhere 
    public exportLabels(fileName: string): void {
        function solveForKandB(x1: number, y1: number, x2: number, y2: number): [number, number] {
            const k = (y2 - y1) / (x2 - x1);
            const b = y1 - k * x1;
            return [k, b];
        }
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
                const [k, b] = solveForKandB(localStart, referenceStart, localEnd, referenceEnd);
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

    @action
    private loadProjectHelper(project: SavedProject, loadProjectCallback: () => any): void {
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
            const result = new AlignedTimeSeries(
                track.id,
                timeSeries.referenceStart,
                timeSeries.referenceEnd,
                [],
                timeSeries.source,
                timeSeries.aligned,
            );
            result.id = timeSeries.id;
            const cb = deferred.callback();
            loadContentFromFile(result.source, ts => {
                result.timeSeries = ts;
                cb();
            });
            return result;
        };

        // Load saved track.
        const loadTrack = (track: SavedTrack): Track => {
            const result = new Track(track.id, track.minimized, []);
            result.alignedTimeSeries = track.timeSeries.map((ts) => loadTimeSeries(result, ts));
            return result;
        };

        // Load the tracks.
        const newReferenceTrack = loadTrack(project.referenceTrack);
        const newTracks = project.tracks.map(loadTrack);

        deferred.onComplete(() => {
            runInAction(() => {
                // Set the new tracks once they are loaded successfully.
                this.referenceTrack = newReferenceTrack;
                this.tracks = newTracks;

                // Load alignment and labeling.
                alignmentStore.loadState(project.alignment);
                labelingStore.loadState(project.labeling);

                // TODO: Load the reference zooming info here.
                projectUiStore.setProjectReferenceViewZooming(project.ui.referenceViewStart, project.ui.referenceViewPPS);
                // TODO: Load the tabs here.
                if (project.ui.currentTab === 'file') {
                    projectUiStore.currentTab = 'alignment';
                } else {
                    projectUiStore.currentTab = project.ui.currentTab;
                }

                if (loadProjectCallback) { loadProjectCallback(); }
            });
        });
    }

    @action
    public newProject(): void {
        this.projectFileLocation = null;
        this.referenceTrack = null;
        this.tracks = [];

        // Load alignment and labeling.
        alignmentStore.reset();
        labelingStore.reset();

        // TODO: Load the reference zooming info here.
        projectUiStore.setProjectReferenceViewZooming(0, 1);
        // TODO: Load the tabs here.
        projectUiStore.currentTab = 'alignment';
    }

    private getAlignmentSnapshot(): SavedAlignmentSnapshot {
        const cloneTrack = (track: Track): Track => {
            if (track === null) { return null; }
            const result = new Track(track.id, track.minimized, []);
            result.alignedTimeSeries = track.alignedTimeSeries.map((x) => AlignedTimeSeries.clone(x, result));
            return result;
        };
        return {
            referenceTrack: cloneTrack(this.referenceTrack),
            tracks: this.tracks.map(cloneTrack),
            alignment: alignmentStore.saveState()
        };
    }

    private loadAlignmentSnapshot(snapshot: SavedAlignmentSnapshot): void {
        this.referenceTrack = snapshot.referenceTrack;
        this.tracks = snapshot.tracks;
        alignmentStore.loadState(snapshot.alignment);
    }

    private getLabelingSnapshot(): SavedLabelingSnapshot {
        return { labeling: deepClone(labelingStore.saveState()) };
    }

    private loadLabelingSnapshot(snapshot: SavedLabelingSnapshot): void {
        labelingStore.loadState(snapshot.labeling);
    }

    public alignmentHistoryRecord(): void {
        this._alignmentHistory.add(this.getAlignmentSnapshot());
    }

    private alignmentHistoryReset(): void {
        this._alignmentHistory.reset();
    }

    public labelingHistoryRecord(): void {
        this._labelingHistory.add(this.getLabelingSnapshot());
    }

    private labelingHistoryReset(): void {
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
