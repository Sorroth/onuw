type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
    level: LogLevel;
    message: string;
    data?: any;
}

interface CursorLogMessage {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
}

class Logger {
    private formatForCursor(level: LogLevel, message: string, data?: any): CursorLogMessage {
        return {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            data
        };
    }

    private async sendToServer(message: LogMessage) {
        try {
            await fetch('http://localhost:8080/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(message),
            });
        } catch (error) {
            // Don't use logger here to avoid infinite loop
            console.error('Failed to send log to server:', error);
        }
    }

    private logToCursor(logMessage: CursorLogMessage) {
        // This special format will be picked up by cursor
        console.log('CURSOR_LOG:', JSON.stringify(logMessage));
    }

    debug(message: string, data?: any) {
        this.logToCursor(this.formatForCursor('debug', message, data));
        this.sendToServer({ level: 'debug', message, data });
    }

    info(message: string, data?: any) {
        this.logToCursor(this.formatForCursor('info', message, data));
        this.sendToServer({ level: 'info', message, data });
    }

    warn(message: string, data?: any) {
        this.logToCursor(this.formatForCursor('warn', message, data));
        this.sendToServer({ level: 'warn', message, data });
    }

    error(message: string, data?: any) {
        this.logToCursor(this.formatForCursor('error', message, data));
        this.sendToServer({ level: 'error', message, data });
    }
}

export const logger = new Logger(); 