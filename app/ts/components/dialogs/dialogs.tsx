// Handles logic that require dialogs.
// - Prompt the user to open/save projects.

import * as actions from '../../actions/Actions';
import * as stores from '../../stores/stores';
import {remote} from 'electron';


// We should save one .labels file for each input file
export function exportLabels() {
    new actions.CommonActions.ExportLabels().dispatch();
}


// Show the save project dialog, once file is selected, save the project.
export function showSaveProjectDialog(onSaved: () => any = null, onCanceled: () => any = null): void {
    remote.dialog.showSaveDialog(
        remote.BrowserWindow.getFocusedWindow(), {
            filters: [
                { name: 'Project Metadata', extensions: ['json'] }
            ]
        },
        (fileName: string) => {
            if (fileName) {
                new actions.CommonActions.SaveProject(fileName).dispatch();
                if (onSaved) { onSaved(); }
            } else {
                if (onCanceled) { onCanceled(); }
            }
        });
}

// Save project as (always show a dialog that asks for a file).
export function saveProjectAs(): void {
    showSaveProjectDialog();
}

// Save the current project. Show a dialog if there is not project file on record.
export function saveCurrentProject(onSaved: () => any = null, onCanceled: () => any = null): void {
    if (stores.alignmentLabelingStore.projectFileLocation) {
        new actions.CommonActions.SaveProject(stores.alignmentLabelingStore.projectFileLocation).dispatch();
        setImmediate(onSaved);
    } else {
        showSaveProjectDialog(onSaved, onCanceled);
    }
}

// If there is an existing project, ask the user if s/he want to save it (and save if s/he answered yes).
// onProceed: the user saved the project, or discarded.
// onCanceled: the user canceled the action.
export function promptSaveExistingProject(onProceed: () => any = null, onCanceled: () => any = null): void {
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
                    saveCurrentProject(
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
export function newProject(): void {
    promptSaveExistingProject(() => {
        // New Project.
        new actions.CommonActions.NewProject().dispatch();
        // Goto alignment tab.
        new actions.Actions.SwitchTabAction('alignment').dispatch();
    });
}

// Open a project, prompt if there is something to save.
export function openProject(): void {
    promptSaveExistingProject(() => {
        remote.dialog.showOpenDialog(
            remote.BrowserWindow.getFocusedWindow(), {
                properties: ['openFile'],
                filters: [
                    { name: 'Project Metadata', extensions: ['json'] }
                ]
            },
            (fileNames: string[]) => {
                if (fileNames && fileNames.length === 1) {
                    new actions.CommonActions.LoadProject(fileNames[0]).dispatch();
                }
            });
    });
}

// Open a project from a given fileName instead of asking for a fileName.
export function openProjectFromFile(fileName: string): void {
    promptSaveExistingProject(() => {
        new actions.CommonActions.LoadProject(fileName).dispatch();
    });
}
