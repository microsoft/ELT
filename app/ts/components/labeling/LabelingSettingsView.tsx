// The settings (options) view for labeling. 
// FIXME: There's currently no settings for alignment, and some of the settings are shared but all in this file.

import { SignalsViewMode } from '../../stores/dataStructures/labeling';
import * as stores from '../../stores/stores';
import { labelingSuggestionGenerator } from '../../suggestion/LabelingSuggestionGenerator';
import { LabelingSuggestionLogicType } from '../../suggestion/LabelingSuggestionLogic';
import { ConfidenceSlider } from '../common/ConfidenceSlider';
import { observer } from 'mobx-react';
import * as React from 'react';




@observer
export class LabelingSettingsView extends React.Component<{}, {}> {

    private setSuggestionLogicThunk: { [logicType: number]: () => void } = {};
    private setViewModeThunk: { [viewMode: number]: () => void } = {};

    constructor(props: {}, context: any) {
        super(props, context);

        this.turnOnSuggestions = this.turnOnSuggestions.bind(this);
        this.turnOffSuggestions = this.turnOffSuggestions.bind(this);
        this.setConfidenceThreshold = this.setConfidenceThreshold.bind(this);

        Object.keys(LabelingSuggestionLogicType).forEach(name => {
            const val = LabelingSuggestionLogicType[name];
            this.setSuggestionLogicThunk[val] = this.setSuggestionLogic.bind(this, val);
        });
        Object.keys(SignalsViewMode).forEach(name => {
            const val = SignalsViewMode[name];
            this.setViewModeThunk[val] = this.setViewMode.bind(this, val);
        });
    }

    private turnOnSuggestions(): void {
        stores.labelingUiStore.setSuggestionEnabled(true);
    }

    private turnOffSuggestions(): void {
        stores.labelingUiStore.setSuggestionEnabled(false);
        stores.labelingStore.removeAllSuggestions();
        labelingSuggestionGenerator.removeAllSuggestions();
    }

    private setConfidenceThreshold(value: number): void {
        stores.labelingUiStore.setSuggestionConfidenceThreshold(Math.max(0.001, Math.min(0.999, Math.pow(value, 1.0 / 0.3))));
    }

    private setSuggestionLogic(logicType: LabelingSuggestionLogicType): void {
        stores.labelingUiStore.setSuggestionLogic(logicType);
    }

    private setViewMode(viewMode: SignalsViewMode): void {
        stores.labelingUiStore.setSignalsViewMode(viewMode);
    }

    public render(): JSX.Element {
        const logicClassName = (log: LabelingSuggestionLogicType) => {
            return stores.labelingUiStore.suggestionLogic.getType() === log ? 'tbtn-l1 active' : 'tbtn-l3';
        };
        const viewModeClassName = (mode: SignalsViewMode) => {
            return stores.labelingUiStore.signalsViewMode === mode ? 'tbtn-l1 active' : 'tbtn-l3';
        };
        return (
            <div className='labeling-options-menu labeling-menu'>
                <h2>Suggestions</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                            onClick={this.turnOnSuggestions}
                            >On</button>
                        <button
                            type='button'
                            className={`tbtn ${!stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                            onClick={this.turnOffSuggestions}
                            >Off</button>
                    </span>
                </p>

                {stores.labelingUiStore.suggestionEnabled ? (
                    <div>
                        <ConfidenceSlider
                            viewWidth={400}
                            viewHeight={50}
                            min={0}
                            max={1}
                            value={Math.pow(stores.labelingUiStore.suggestionConfidenceThreshold, 0.3)}
                            histogram={stores.labelingUiStore.suggestionConfidenceHistogram}
                            onChange={this.setConfidenceThreshold}
                            />
                        <p>Status: {labelingSuggestionGenerator.modelStatus}</p>

                    </div>
                ) : null}

                <h2>Suggestion Logic</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.CURRENT_VIEW)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.CURRENT_VIEW]}
                            >Current View</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD]}
                            >Forward / Keep</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD_CONFIRM)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_CONFIRM]}
                            >Forward / Confirm</button>
                        <button
                            type='button'
                            className={`tbtn ${logicClassName(LabelingSuggestionLogicType.FORWARD_REJECT)}`}
                            onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_REJECT]}
                            >Forward / Reject</button>
                    </span>
                </p>
                <p>{stores.labelingUiStore.suggestionLogic.getDescription()}</p>

                <h2>Signals Display</h2>
                <p>
                    <span className='tbtn-group'>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.TIMESERIES)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.TIMESERIES]}
                            >Time series</button>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.AUTOCORRELOGRAM)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.AUTOCORRELOGRAM]}
                            >Autocorrelogram</button>
                        <button
                            type='button'
                            className={`tbtn ${viewModeClassName(SignalsViewMode.COMBINED)}`}
                            onClick={this.setViewModeThunk[SignalsViewMode.COMBINED]}
                            >Both</button>
                    </span>
                </p>
            </div>
        );
    }
}
