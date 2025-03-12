export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    data?: any;
    stack?: string;
}

class Logger {
    private static instance: Logger;
    private apiEndpoint: string;

    private constructor() {
        this.apiEndpoint = `${process.env.REACT_APP_API_URL}/logs`;
        this.setupGlobalErrorHandling();
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private async sendToServer(entry: LogEntry): Promise<void> {
        try {
            await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry),
            });
        } catch (error) {
            console.error('Failed to send log to server:', error);
        }
    }

    private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            data,
            stack: new Error().stack
        };
    }

    private setupGlobalErrorHandling(): void {
        window.onerror = (message, source, lineno, colno, error) => {
            this.error('Global error:', {
                message,
                source,
                lineno,
                colno,
                error
            });
        };

        window.onunhandledrejection = (event) => {
            this.error('Unhandled promise rejection:', {
                reason: event.reason
            });
        };
    }

    public debug(message: string, data?: any): void {
        const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
        console.debug(message, data);
        this.sendToServer(entry);
    }

    public info(message: string, data?: any): void {
        const entry = this.createLogEntry(LogLevel.INFO, message, data);
        console.info(message, data);
        this.sendToServer(entry);
    }

    public warn(message: string, data?: any): void {
        const entry = this.createLogEntry(LogLevel.WARN, message, data);
        console.warn(message, data);
        this.sendToServer(entry);
    }

    public error(message: string, data?: any): void {
        const entry = this.createLogEntry(LogLevel.ERROR, message, data);
        console.error(message, data);
        this.sendToServer(entry);
    }
}

export const logger = Logger.getInstance(); 