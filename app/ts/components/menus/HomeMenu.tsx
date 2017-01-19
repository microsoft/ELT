import * as stores from '../../stores/stores';
import {remote} from 'electron';
import { observer } from 'mobx-react';
import * as path from 'path';
import * as React from 'react';


// The 'Home' menu.
@observer
export class HomeMenu extends React.Component<{}, {}> {
    constructor(props: {}, context: any) {
        super(props, context);

        this.newProject = this.newProject.bind(this);
        this.openProject = this.openProject.bind(this);
        this.saveProjectAs = this.saveProjectAs.bind(this);
        this.openProjectFromFile = this.openProjectFromFile.bind(this);
        this.exportLabels = this.exportLabels.bind(this);
    }

    // We should save one .labels file for each input file
    public exportLabels(): void {
        this.showExportLabelsDialog();
    }

    private showExportLabelsDialog(onSaved: () => any = null, onCanceled: () => any = null): void {
        remote.dialog.showSaveDialog(
            remote.BrowserWindow.getFocusedWindow(), {
                filters: [
                    { name: 'tsv', extensions: ['tsv'] }
                ]
            },
            (fileName: string) => {
                if (fileName) {
                    stores.alignmentLabelingStore.exportLabels(fileName);
                    if (onSaved) { onSaved(); }
                } else {
                    if (onCanceled) { onCanceled(); }
                }
            });
    }

    // Show the save project dialog, once file is selected, save the project.
    private showSaveProjectDialog(onSaved: () => any = null, onCanceled: () => any = null): void {
        remote.dialog.showSaveDialog(
            remote.BrowserWindow.getFocusedWindow(), {
                filters: [
                    { name: 'Project Metadata', extensions: ['json'] }
                ]
            },
            (fileName: string) => {
                if (fileName) {
                    stores.alignmentLabelingStore.saveProject(fileName);
                    if (onSaved) { onSaved(); }
                } else {
                    if (onCanceled) { onCanceled(); }
                }
            });
    }

    // Save project as (always show a dialog that asks for a file).
    public saveProjectAs(): void {
        this.showSaveProjectDialog();
    }

    // Save the current project. Show a dialog if there is not project file on record.
    private saveCurrentProject(onSaved: () => any = null, onCanceled: () => any = null): void {
        if (stores.alignmentLabelingStore.projectFileLocation) {
            // FIXME
            stores.alignmentLabelingStore.saveProject(stores.alignmentLabelingStore.projectFileLocation);
            setImmediate(onSaved);
        } else {
            this.showSaveProjectDialog(onSaved, onCanceled);
        }
    }

    // If there is an existing project, ask the user if s/he want to save it (and save if s/he answered yes).
    // onProceed: the user saved the project, or discarded.
    // onCanceled: the user canceled the action.
    private promptSaveExistingProject(onProceed: () => any = null, onCanceled: () => any = null): void {
        if (stores.alignmentLabelingStore.referenceTrack !== null) {
            // If there is an existing project, prompt if the user want to save.
            // Currently we don't detect changes, so will always prompt if a project is already opened.
            remote.dialog.showMessageBox(
                remote.BrowserWindow.getFocusedWindow(), {
                    type: 'question',
                    message: 'Do you want to save your current project?',
                    buttons: ['Save', 'Discard', 'Cancel']
                },
                (response) => {
                    if (response === 0) { // User clicked 'Save'
                        // If we have a saved location, save.
                        this.saveCurrentProject(
                            () => {
                                if (onProceed) { onProceed(); }
                            },
                            () => {
                                if (onCanceled) { onCanceled(); }
                            });
                    } else if (response === 1) { // User clicked 'Discard'
                        if (onProceed) { onProceed(); }
                    }
                });
        } else {
            setImmediate(onProceed);
        }
    }

    // New project, prompt if there is something to save.
    public newProject(): void {
        this.promptSaveExistingProject(() => {
            // New Project.
            stores.alignmentLabelingStore.newProject();
            // Goto alignment tab.
            stores.uiStore.switchTab('alignment');
        });
    }

    // Open a project, prompt if there is something to save.
    public openProject(): void {
        this.promptSaveExistingProject(() => {
            remote.dialog.showOpenDialog(
                remote.BrowserWindow.getFocusedWindow(), {
                    properties: ['openFile'],
                    filters: [
                        { name: 'Project Metadata', extensions: ['json'] }
                    ]
                },
                (fileNames: string[]) => {
                    if (fileNames && fileNames.length === 1) {
                        stores.alignmentLabelingStore.loadProject(fileNames[0]);
                    }
                });
        });
    }

    // Open a project from a given fileName instead of asking for a fileName.
    public openProjectFromFile(fileName: string): void {
        this.promptSaveExistingProject(() => {
            stores.alignmentLabelingStore.loadProject(fileName);
        });
    }


    public render(): JSX.Element {
        return (
            <div className='app-menu file-menu'>
                <h1>Home</h1>
                <div className='row'>
                    <div className='col-md-4'>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={this.newProject}>
                                <span className='glyphicon glyphicon-file'></span>New Project...
                            </button>
                        </p>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={this.openProject}>
                                <span className='glyphicon glyphicon-open'></span>Open Project...
                            </button>
                        </p>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={this.saveProjectAs}>
                                <span className='glyphicon glyphicon-save'></span>Save Project As...
                            </button>
                        </p>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={this.exportLabels}>
                                <span className='glyphicon glyphicon-save'></span>Export Labels...
                            </button>
                        </p>
                    </div>
                    <div className='col-md-8'>
                        <h2>Recent Projects</h2>
                        <div className='recent-projects'>
                            {
                                stores.alignmentLabelingStore.recentProjects.map(fileName =>
                                    <div className='project-item'
                                        key={fileName} role='button'
                                        onClick={event => this.openProjectFromFile(fileName)}>
                                        <div className='filename'>{path.basename(fileName)}</div>
                                        <div className='path'>{path.dirname(fileName)}</div>
                                    </div>
                                )
                            }
                        </div>
                    </div>
                </div>
            </div >
        );
    }
}
