// AlignmentLabelingStore
// Stores the information about tracks and handles project load/save and undo/redo state saving.

import { Track } from './dataStructures/alignment';
import { loadMultipleSensorTimeSeriesFromFile, loadRawSensorTimeSeriesFromFile, loadVideoTimeSeriesFromFile }
    from './dataStructures/dataset';
import { DeferredCallbacks } from './dataStructures/DeferredCallbacks';
import { HistoryTracker } from './dataStructures/HistoryTracker';
import { PanZoomParameters } from './dataStructures/PanZoomParameters';
import { SavedAlignmentSnapshot, SavedLabelingSnapshot, SavedProject, SavedTrack }
    from './dataStructures/project';
import { convertToWebm, fadeBackground, isWebm } from './dataStructures/video';
import { alignmentStore, labelingStore, projectUiStore } from './stores';
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

// Stores the information about tracks and handles project load/save and undo/redo state saving.
export class ProjectStore {

    // Reference track and other tracks.
    @observable public referenceTrack: Track;
    @observable public tracks: Track[];

    // The location of the saved/opened project.
    @observable public projectFileLocation: string;

    @observable public statusMessage: string;

    @observable public shouldFadeVideoBackground: boolean = false;
    private originalReferenceTrackFilename: string = null;
    private fadedReferenceTrackFilename: string = null;


    // Stores alignment and labeling history (undo is implemented separately, you can't undo alignment from labeling or vice versa).
    private _alignmentHistory: HistoryTracker<SavedAlignmentSnapshot>;
    private _labelingHistory: HistoryTracker<SavedLabelingSnapshot>;

    constructor() {
        this._alignmentHistory = new HistoryTracker<SavedAlignmentSnapshot>();
        this._labelingHistory = new HistoryTracker<SavedLabelingSnapshot>();
        this.referenceTrack = null;
        this.tracks = [];
        this.projectFileLocation = null;
        this.statusMessage = '';

        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
    }


    public getTrackByID(trackId: string): Track {
        // There are so few tracks that linear search is fine.
        return this.tracks.concat(this.referenceTrack).filter(t => t.id === trackId)[0];
    }

    // Keep the time range of the reference track.
    @computed public get referenceTimestampStart(): number {
        return this.referenceTrack && this.referenceTrack ?
            this.referenceTrack.referenceStart
            : 0;
    }

    @computed public get referenceTimestampEnd(): number {
        return this.referenceTrack && this.referenceTrack ?
            this.referenceTrack.referenceEnd
            : 100;
    }

    @computed public get referenceTimeDuration(): number {
        return this.referenceTimestampEnd - this.referenceTimestampStart;
    }

    @computed public get canUndo(): boolean {
        if ( (projectUiStore.currentTab === 'alignment' && this._labelingHistory.canUndo) ||
         (projectUiStore.currentTab === 'labeling' && this._alignmentHistory.canUndo) ) {
            return true;
        } else {
            return false;
        }
    }

    @computed public get canRedo(): boolean {
        if ( (projectUiStore.currentTab === 'alignment' && this._labelingHistory.canRedo) ||
         (projectUiStore.currentTab === 'labeling' && this._alignmentHistory.canRedo) ) {
            return true;
        } else {
            return false;
        }
    }

    @action public loadReferenceTrack(path: string): void {
        this.alignmentHistoryRecord();
        loadVideoTimeSeriesFromFile(path, video => {
            if (!isWebm(path)) {
                const newPath = convertToWebm( // FIXME: newPath is never used
                    path, video.videoDuration,
                    pctDone => {
                       this.statusMessage = 'converting video: ' + (pctDone * 100).toFixed(0) + '%';
                    },
                    webmVideo => {
                        this.referenceTrack = Track.fromFile(webmVideo.filename, [webmVideo]);
                        this.statusMessage = '';
                    });
            }
            this.referenceTrack = Track.fromFile(path, [video]);
        });
    }

    public isReferenceTrack(track: Track): boolean {
        return this.referenceTrack != null && track.id === this.referenceTrack.id;
    }

    @action public loadVideoTrack(fileName: string): void {
        this.alignmentHistoryRecord();
        loadVideoTimeSeriesFromFile(fileName, video => {
            this.tracks.push(Track.fromFile(fileName, [video]));
        });
    }

    @action public loadSensorTrack(fileName: string): void {
        this.alignmentHistoryRecord();
        const sensors = loadMultipleSensorTimeSeriesFromFile(fileName);
        this.tracks.push(Track.fromFile(fileName, sensors));
    }

    @action public fadeBackground(userChoice: boolean): void {
        this.shouldFadeVideoBackground = userChoice;
        if (this.shouldFadeVideoBackground) {
            this.originalReferenceTrackFilename = this.referenceTrack.source;
            if (this.fadedReferenceTrackFilename == null) {
                fadeBackground(
                    this.referenceTrack.source, this.referenceTrack.duration,
                    frac => this.statusMessage = 'Converting video...' + (frac * 100).toFixed(0) + '%',
                    video => {
                        this.fadedReferenceTrackFilename = video.filename;
                        this.referenceTrack = Track.fromFile(video.filename, [video]);
                        this.statusMessage = '';
                    });
            } else {
                this.loadReferenceTrack(this.fadedReferenceTrackFilename);
            }
        } else if (this.referenceTrack.source != null) {
            this.loadReferenceTrack(this.originalReferenceTrackFilename);
        }
    }

    @action public deleteTrack(track: Track): void {
        this.alignmentHistoryRecord();
        const index = this.tracks.map(t => t.id).indexOf(track.id);
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

    @action public loadProject(fileName: string): void {
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

    @action public saveProject(fileName: string): void {
        const project = this.saveProjectHelper();
        const json = JSON.stringify(project, null, 2);
        fs.writeFileSync(fileName, json, 'utf-8');
        this.projectFileLocation = fileName;
        this.addToRecentProjects(fileName);
    }

    private saveProjectHelper(): SavedProject {
        const saveTrack = (track: Track): SavedTrack => {
            return {
                id: track.id,
                minimized: track.minimized,
                referenceStart: track.referenceStart,
                referenceEnd: track.referenceEnd,
                source: track.source,
                aligned: track.isAlignedToReferenceTrack
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
                referenceViewStart: projectUiStore.referenceTrackPanZoom.rangeStart,
                referenceViewPPS: projectUiStore.referenceTrackPanZoom.pixelsPerSecond
            }
        };
    }

    public exportLabels(fileName: string): void {
        function solveForKandB(x1: number, y1: number, x2: number, y2: number): [number, number] {
            const k = (y2 - y1) / (x2 - x1);
            const b = y1 - k * x1;
            return [k, b];
        }
        // for each timeseries, get the source file, and save to a .labels file
        this.tracks.map(track => {
            const sourceFile = track.source;
            //const destinationFile = sourceFile + '.labels.tsv';
            // read in the source file via dataset.ts (see loadMultipleSensorTimeSeriesFromFile)
            // you can also get the timestampStart and timestampEnd from this
            // which you want to map to timeSeries.referenceStart and timeSeries.referenceEnd
            const rawSensorData = loadRawSensorTimeSeriesFromFile(sourceFile);
            const localStart = rawSensorData.timestampStart;
            const localEnd = rawSensorData.timestampEnd;
            const referenceStart = track.referenceStart;
            const referenceEnd = track.referenceEnd;
            // use these to recompute k and b
            const [k, b] = solveForKandB(localStart, referenceStart, localEnd, referenceEnd);
            // get the labels from labelingStore .labels()
            // map the timestamps of the labels from the reference time to the time of the current time series
            // (i.e., localTime = (refTime - b)/k)
            const mappedLabels = labelingStore.labels.map(label => {
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
    }

    @action private loadProjectHelper(project: SavedProject, loadProjectCallback: () => any): void {
        const deferred = new DeferredCallbacks();

        // Load saved track.
        const loadTrack = (track: SavedTrack): Track => {
            const result = new Track(
                track.id, track.minimized,
                [],
                track.source,
                track.aligned,
                track.referenceStart,
                track.referenceEnd
            );
            result.id = track.id;
            const cb = deferred.callback();
            // Load TimeSeries data from a file.
            const fileName = result.source;
            const callback = ts => {
                result.timeSeries = ts;
                cb();
            };
            if (fileName.match(/\.tsv$/i)) {
                const ts = loadMultipleSensorTimeSeriesFromFile(fileName);
                callback(ts);
            }
            if (fileName.match(/\.(webm|mp4|mov)$/i)) {
                loadVideoTimeSeriesFromFile(fileName, ts => {
                    callback([ts]);
                });
            }
            return result;
        };

        // Load the tracks.
        const newReferenceTrack = loadTrack(project.referenceTrack);
        const newTracks = project.tracks.map(loadTrack);

        deferred.onComplete(() => {
            runInAction('loadProjectHelper', () => {
                // Set the new tracks once they are loaded successfully.
                this.referenceTrack = newReferenceTrack;
                this.tracks = newTracks;

                // Load alignment and labeling.
                alignmentStore.loadState(project.alignment);
                labelingStore.loadState(project.labeling);

                projectUiStore.setReferenceTrackPanZoom(
                    new PanZoomParameters(project.ui.referenceViewStart, project.ui.referenceViewPPS));
                if (project.ui.currentTab === 'file') {
                    projectUiStore.currentTab = 'alignment';
                } else {
                    projectUiStore.currentTab = project.ui.currentTab;
                }

                if (loadProjectCallback) { loadProjectCallback(); }
            });
        });
    }

    @action public newProject(): void {
        this.projectFileLocation = null;
        this.referenceTrack = null;
        this.tracks = [];
        alignmentStore.reset();
        labelingStore.reset();
        projectUiStore.setReferenceTrackPanZoom(new PanZoomParameters(0, 1));
        projectUiStore.currentTab = 'alignment';
    }

    private getAlignmentSnapshot(): SavedAlignmentSnapshot {
        return {
            referenceTrack: Track.clone(this.referenceTrack),
            tracks: this.tracks.map(Track.clone),
            alignment: alignmentStore.saveState()
        };
    }

    private loadAlignmentSnapshot(snapshot: SavedAlignmentSnapshot): void {
        this.referenceTrack = snapshot.referenceTrack;
        alignmentStore.loadState(snapshot.alignment);
        this.tracks = snapshot.tracks;
    }

    private getLabelingSnapshot(): SavedLabelingSnapshot {
        return { labeling: deepClone(labelingStore.saveState()) };
    }

    private loadLabelingSnapshot(snapshot: SavedLabelingSnapshot): void {
        labelingStore.loadState(snapshot.labeling);
    }

    // FIXME: rename history record
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

    public undo(): void {
        if ( projectUiStore.currentTab === 'alignment') {
            const snapshot = this._alignmentHistory.undo(this.getAlignmentSnapshot());
            if (snapshot) {
                this.loadAlignmentSnapshot(snapshot);
            }
        } else {
            const snapshot = this._labelingHistory.undo(this.getLabelingSnapshot());
            if (snapshot) {
                this.loadLabelingSnapshot(snapshot);
            }
        }
    }

   public redo(): void {
        if ( projectUiStore.currentTab === 'alignment') {
            const snapshot = this._alignmentHistory.redo(this.getAlignmentSnapshot());
            if (snapshot) {
                this.loadAlignmentSnapshot(snapshot);
            }
        } else {
            const snapshot = this._labelingHistory.redo(this.getLabelingSnapshot());
            if (snapshot) {
                this.loadLabelingSnapshot(snapshot);
            }
        }
    }

}
