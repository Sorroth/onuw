import React from 'react';
import { NightAction } from 'types/game';

interface ActionResultProps {
    action: NightAction;
}

export const ActionResult: React.FC<ActionResultProps> = ({ action }) => {
    if (!action.result || !action.result.success) return null;

    const resultClass = action.result.success ? 'success' : 'error';

    return (
        <div className={`action-result ${resultClass}`}>
            <p>{action.result.message}</p>
            {action.result.data && (
                <div className="result-data">
                    {typeof action.result.data === 'string' ? (
                        <p>{action.result.data}</p>
                    ) : (
                        <pre>{JSON.stringify(action.result.data, null, 2)}</pre>
                    )}
                </div>
            )}
        </div>
    );
}; 