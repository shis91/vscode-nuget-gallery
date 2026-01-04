import * as os from 'os';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';

export class SystemUtils {
    static getHomeDir(): string {
        return os.homedir();
    }

    static spawn(command: string, args: string[], options: SpawnOptions): ChildProcess {
        return spawn(command, args, options);
    }
}
