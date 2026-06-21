import { spawn } from 'node:child_process';
import { ProcessRunner, RunningProcess } from './process-runner';

export const createRealRunner = (): ProcessRunner => ({
  start(command, args): RunningProcess {
    const child = spawn(command, args, { stdio: 'inherit' });
    return {
      kill: () => child.kill('SIGTERM'),
      onExit: (handler) => child.on('exit', (code) => handler(code)),
    };
  },
});
