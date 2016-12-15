import {labelingSuggestionGenerator} from '../../stores/LabelingSuggestionGenerator';
import * as stores from '../../stores/stores';
import * as dialogs from '../dialogs/dialogs';
import {LabelingSettingsView} from '../labeling/LabelingSettingsView';
import * as electron from 'electron';
import * as path from 'path';
import * as React from 'react';


// The 'Home' menu.
export class FileMenu extends React.Component<{}, {}> {
    constructor(props: {}, context: any) {
        super(props, context);
    }

    public render(): JSX.Element {
        return (
            <div className='app-menu file-menu'>
                <h1>Home</h1>
                <div className='row'>
                    <div className='col-md-4'>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={dialogs.newProject}>
                                <span className='glyphicon glyphicon-file'></span>New Project...
                            </button>
                        </p>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={dialogs.openProject}>
                                <span className='glyphicon glyphicon-open'></span>Open Project...
                            </button>
                        </p>
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={dialogs.saveProjectAs}>
                                <span className='glyphicon glyphicon-save'></span>Save Project As...
                            </button>
                        </p>
                    </div>
                    <div className='col-md-8'>
                        <h2>Recent Projects</h2>
                        <div className='recent-projects'>
                            {
                                stores.alignmentLabelingStore.recentProjects.map(fileName =>
                                    <div className='project-item'
                                        key = {fileName} role='button'
                                        onClick={ event => dialogs.openProjectFromFile(fileName) }>
                                        <div className='filename'>{path.basename(fileName) }</div>
                                        <div className='path'>{path.dirname(fileName) }</div>
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

// The 'Options' menu.
export class OptionsMenu extends React.Component<{}, {}> {
    constructor(props: {}, context: any) {
        super(props, context);
    }

    public render(): JSX.Element {
        return (
            <div className='app-menu options-menu'>
                <h1>Options</h1>
                <LabelingSettingsView />
            </div>
        );
    }
}




interface DeploymentMenuState {
    arduinoCode?: string;
    microbitCode?: string;
}

export class DeploymentMenu extends React.Component<{}, DeploymentMenuState> {
    constructor(props: {}, context: any) {
        super(props, context);
        this.state = { arduinoCode: '', microbitCode: '' };
        this.deployModel = this.deployModel.bind(this);
    }

    public componentDidMount(): void {
        labelingSuggestionGenerator.getDeploymentCode('arduino', (code) => {
            this.setState({ arduinoCode: code });
        });
        labelingSuggestionGenerator.getDeploymentCode('microbit', (code) => {
            this.setState({ microbitCode: code });
        });
    }

    private deployModel(): void {
        labelingSuggestionGenerator.getDeploymentCode('arduino', (code) => {
            this.setState({ arduinoCode: code });
            electron.remote.clipboard.clear();
            electron.remote.clipboard.writeText(code);
        });
    }

    public render(): JSX.Element {
        return (
            <div className='app-menu deployment-menu'>
                <h1>Deploy</h1>
                <p>Here is the Arduino code to run your model in a device.</p>
                <p><pre>{this.state.arduinoCode}</pre></p>
                <p>
                    <button className='tbtn tbtn-tile tbtn-l3' onClick={this.deployModel}>
                        <span className='glyphicon glyphicon-export'></span>Deploy Model
                    </button>
                </p>
            </div>
        );
    }
}
