import React from 'react';
import { NightAction, RoleType } from '../types/game';

interface ActionResultProps {
    action: NightAction;
}

type ActionResultData = {
    newRole?: RoleType;
    werewolves?: string[];
    canViewCenter?: boolean;
    [key: string]: RoleType | string[] | boolean | undefined;
};

export const ActionResult: React.FC<ActionResultProps> = ({ action }) => {
    if (!action.result || !action.result.success) return null;

    const formatValue = (value: unknown): string => {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return String(value);
    };

    return (
        <div className={`action-result ${!action.result.success ? 'error' : ''}`}>
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