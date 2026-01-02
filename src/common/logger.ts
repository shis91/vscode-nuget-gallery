import * as vscode from 'vscode';
import * as util from 'util';

export class Logger {
    private static _outputChannel: vscode.OutputChannel;

    public static configure(context: vscode.ExtensionContext): void {
        this._outputChannel = vscode.window.createOutputChannel("NuGet Gallery");
        context.subscriptions.push(this._outputChannel);
    }

    public static log(level: string, message: string, ...args: any[]): void {
        if (this._outputChannel) {
            const timestamp = new Date().toISOString();
            const formattedMessage = util.format(message, ...args);
            this._outputChannel.appendLine(`[${timestamp}] [${level}] ${formattedMessage}`);
        }
    }

    public static info(message: string, ...args: any[]): void {
        this.log('INFO', message, ...args);
    }

    public static warn(message: string, ...args: any[]): void {
        this.log('WARN', message, ...args);
    }

    public static error(message: string, ...args: any[]): void {
        this.log('ERROR', message, ...args);
    }
}
