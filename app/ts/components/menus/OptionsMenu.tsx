import { LabelingSettingsView } from '../labeling/LabelingSettingsView';
import * as React from 'react';

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

