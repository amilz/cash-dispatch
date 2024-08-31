import { exec } from "child_process";

// Function to execute a shell command
function runShellCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`stderr: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });
}

// Using the function in a test or any async context
export async function initIdlToChain() {
    try {
        const output = await runShellCommand('anchor run init_idl');
        // console.log(`  `, output);
    } catch (error) {
        console.error('Command failed:', error);
    }
};
