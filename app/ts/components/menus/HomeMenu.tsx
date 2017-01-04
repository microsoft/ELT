import * as React from 'react';
import * as dialogs from '../dialogs/dialogs';
import * as stores from '../../stores/stores';
import * as path from 'path';

// The 'Home' menu.
export class HomeMenu extends React.Component<{}, {}> {
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
                        <p>
                            <button className='tbtn tbtn-tile tbtn-l3' onClick={() => {
                                dialogs.exportLabels();
                            } }><span className='glyphicon glyphicon-save'></span>Export Labels...</button>
                        </p>
                    </div>
                    <div className='col-md-8'>
                        <h2>Recent Projects</h2>
                        <div className='recent-projects'>
                            {
                                stores.alignmentLabelingStore.recentProjects.map(fileName =>
                                    <div className='project-item'
                                        key={fileName} role='button'
                                        onClick={event => dialogs.openProjectFromFile(fileName)}>
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