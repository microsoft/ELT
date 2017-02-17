import * as stores from '../../stores/stores';
import { labelingSuggestionGenerator } from '../../stores/stores';
import { LabelingSuggestionLogicType } from '../../suggestion/LabelingSuggestionLogic';
import { ConfidenceSlider } from '../common/ConfidenceSlider';
import { observer } from 'mobx-react';
import * as React from 'react';


@observer
export class SuggestionsToolbar extends React.Component<{}, {}> {
    private setSuggestionLogicThunk: { [logicType: number]: () => void } = {};

    constructor(props: {}, context: any) {
        super(props, context);

        Object.keys(LabelingSuggestionLogicType).forEach(name => {
            const val = LabelingSuggestionLogicType[name];
            this.setSuggestionLogicThunk[val] = this.setSuggestionLogic.bind(this, val);
        });
    }

    private setSuggestionLogic(logicType: LabelingSuggestionLogicType): void {
        stores.labelingUiStore.setSuggestionLogic(logicType);
    }

    private setConfidenceThreshold(value: number): void {
        stores.labelingUiStore.setSuggestionConfidenceThreshold(Math.max(0.001, Math.min(0.999, Math.pow(value, 1.0 / 0.3))));
    }

    public render(): JSX.Element {
        const logicClassName = (log: LabelingSuggestionLogicType) => {
            return stores.labelingUiStore.suggestionLogic.getType() === log ? 'visible' : 'hidden';
        };

        return (
            <div style={{display: 'inline-block'}}>
                Suggestions:
                <span className='tbtn-group' style={{marginLeft: '2pt'}} >
                    <button
                        type='button'
                        className={`tbtn ${stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => stores.labelingUiStore.suggestionEnabled = true}
                    >On</button>
                    <button
                        type='button'
                        className={`tbtn ${!stores.labelingUiStore.suggestionEnabled ? 'tbtn-l1 active' : 'tbtn-l3'}`}
                        onClick={() => {
                            stores.labelingUiStore.suggestionEnabled = false;
                            stores.labelingStore.removeAllSuggestions();
                            labelingSuggestionGenerator.removeAllSuggestions();
                        }}
                    >Off</button>
                </span>
                <button
                    type='button'
                    className='tbtn tbtn-red'
                    title='Confirm all suggested labels'
                    onClick={() => stores.labelingStore.confirmVisibleSuggestions()}
                ><span className='glyphicon icon-only glyphicon-ok'></span></button>
                <div className='btn-group' style={{marginLeft: '2pt'}} >
                        <span className='glyphicon icon-only glyphicon-option-vertical clickable' data-toggle='dropdown'></span>
                        <ul
                            className='dropdown-menu options-menu'>
                            <li className='dropdown-header'>Suggestion Confidence Threshold</li>
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
                                </div>
                            ) : null}
                            <li role='separator' className='divider'></li>
                            <li className='dropdown-header'>Suggestion Logic</li>
                             <li className='option-item'
                                role='button'
                                onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.CURRENT_VIEW]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                    style={{visibility: `${logicClassName(LabelingSuggestionLogicType.CURRENT_VIEW)}`,
                                    marginRight: '5pt'}}/>
                                Suggest Anywhere, Manual Confirm
                            </li>
                            <li className='option-item'
                                role='button'
                                onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                    style={{visibility: `${logicClassName(LabelingSuggestionLogicType.FORWARD)}`,
                                    marginRight: '5pt'}}/>
                                Suggest Forward, Manual Confirm
                            </li>
                            <li className='option-item'
                                role='button'
                                onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_CONFIRM]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                    style={{visibility: `${logicClassName(LabelingSuggestionLogicType.FORWARD_CONFIRM)}`,
                                    marginRight: '5pt'}}/>
                                Suggest Forward, Auto Confirm Inbetween
                            </li>
                             <li className='option-item'
                                role='button'
                                onClick={this.setSuggestionLogicThunk[LabelingSuggestionLogicType.FORWARD_REJECT]}>
                                  <span className='glyphicon icon-only glyphicon-ok'
                                    style={{visibility: `${logicClassName(LabelingSuggestionLogicType.FORWARD_REJECT)}`,
                                    marginRight: '5pt'}}/>
                                Suggest Forward, Auto Reject Inbetween
                            </li>
                        </ul>
                </div>
            </div>
        );
    }
}
